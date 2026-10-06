# Mise en production interne — MUFID UNION

Guide complet pour installer la plateforme sur un poste de l'entreprise et la
faire fonctionner **en continu, sans intervention quotidienne**.

**Machine cible retenue** : PC de bureau, 12 Go de RAM, processeur 2,9 GHz,
2 To de disque, sous Windows.

---

## Raccourci — « le matin, il faut relancer la plateforme »

Si la plateforme est **déjà installée** sur le PC serveur et que le seul
problème est qu'elle ne répond plus le lendemain matin, trois scripts font
tout le travail décrit dans ce guide. À lancer dans une fenêtre **PowerShell
administrateur**, depuis `C:\MUFID\app\exploitation` :

```powershell
# 1. Comprendre ce qui s'est passé cette nuit — ne modifie rien
.\diagnostic-disponibilite.ps1

# 2. Installer la plateforme en services Windows (la vraie correction)
.\installer-services.ps1

# 3. Régler la machine : veille, Windows Update, sauvegardes automatiques
.\configurer-serveur.ps1
```

**Pourquoi cela suffit** : un programme lancé à la main vit dans votre session
Windows. Dès que la session se ferme — déconnexion, redémarrage, mise à jour —
Windows tue **tous** ses processus. Le PC reste allumé, le Bureau à distance
répond, mais l'application a disparu. Un **service** Windows, lui, démarre
avant toute ouverture de session, survit à la fermeture de session et se
relance seul s'il tombe.

Le détail de chaque réglage est expliqué aux sections [2.2](#22-empêcher-la-machine-de-sendormir),
[2.4](#24-maîtriser-les-redémarrages-windows-update), [8](#8-faire-tourner-lapplication-en-permanence)
et [10](#10-sauvegardes-automatiques). Les scripts sont **rejouables** : on peut
les relancer après chaque mise à jour du code.

---

## 1. Les choix retenus, et pourquoi

Avant les commandes, voici les décisions prises pour votre contexte, afin que
vous puissiez les discuter plutôt que les subir.

### On garde Windows

La machine est déjà sous Windows et votre équipe le maîtrise. Installer Linux
apporterait un gain marginal au prix d'une réinstallation complète et d'une
compétence supplémentaire à acquérir. **Windows sait parfaitement faire tourner
un service en continu** — c'est exactement ce dont nous avons besoin.

### Pas de Docker

Docker Desktop sur Windows exige WSL2, consomme plusieurs gigaoctets, et sa
licence devient payante pour les entreprises au-delà d'un certain seuil. Pour
**une seule application sur une seule machine**, il ajoute une couche
d'abstraction sans bénéfice. Une installation native est plus simple à
dépanner — ce qui compte quand on reprend l'exploitation en interne.

> Le guide Docker (`DEPLOIEMENT-DOCKER.md`) reste valable si vous changez
> d'avis plus tard, notamment pour un serveur Linux mutualisé.

### MariaDB, pas MySQL

**C'est impératif, pas une préférence.** Le code utilise `ADD COLUMN IF NOT
EXISTS`, une syntaxe propre à MariaDB que MySQL ne comprend pas. Avec MySQL,
les mises à jour de schéma échoueraient silencieusement.

### Trois services Windows

| Service | Rôle | Démarrage |
|---|---|---|
| **MariaDB** | Base de données | automatique |
| **MufidUnion** | L'application (API + interface) | automatique |
| **MufidWeb** (Caddy) | Frontal HTTPS, port 443 | automatique |

Un service Windows démarre **avant même l'ouverture de session**, redémarre
seul après une coupure et se relance automatiquement s'il plante. C'est la
réponse directe à votre exigence : *ne pas avoir à redémarrer la plateforme*.

### Pourquoi un frontal web (Caddy)

Sans lui, l'application serait jointe par `http://192.168.1.50:8000` — en clair
sur le réseau, **mots de passe compris**. Caddy est un exécutable unique qui
chiffre les échanges avec un certificat interne, sert une adresse propre
(`https://mufid.interne`), compresse les pages et patiente si l'application
redémarre. Pour un établissement supervisé, le chiffrement des mots de passe
sur le réseau interne n'est pas un luxe.

> **Variante plus simple**, si vous préférez une brique de moins : mettez
> `PORT=80` dans le fichier `.env`, n'installez pas Caddy, et accédez à
> `http://mufid-serveur`. Vous perdez le chiffrement — à n'envisager que si le
> réseau est strictement cloisonné.

---

## 2. Préparer la machine

### 2.1 Nommer la machine et figer son adresse

Si l'adresse IP change, plus personne n'accède à la plateforme.

```powershell
# En PowerShell ADMINISTRATEUR
Rename-Computer -NewName "MUFID-SERVEUR" -Restart
```

Après redémarrage, fixez l'adresse IP (adaptez à votre plan d'adressage) :

```powershell
Get-NetAdapter   # repérez le nom de la carte, ex. "Ethernet"

New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.1.50 `
                 -PrefixLength 24 -DefaultGateway 192.168.1.1
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses 192.168.1.1, 8.8.8.8
```

> Faites plutôt **réserver l'adresse sur le routeur** (réservation DHCP par
> adresse MAC) si votre administrateur réseau le propose : c'est plus robuste.

### 2.2 Empêcher la machine de s'endormir

Point capital : un PC de bureau se met en veille par défaut, et la plateforme
devient injoignable.

```powershell
powercfg /change standby-timeout-ac 0     # jamais de veille
powercfg /change hibernate-timeout-ac 0   # jamais d'hibernation
powercfg /change disk-timeout-ac 0        # disques toujours actifs
powercfg /change monitor-timeout-ac 15    # l'écran peut s'éteindre, lui
powercfg /hibernate off
```

Vérifiez aussi dans le BIOS/UEFI l'option **« Restore on AC Power Loss »** ou
« After Power Failure » : réglez-la sur **Power On**, pour que la machine
redémarre seule après une coupure de courant.

### 2.3 Onduleur — à ne pas négliger

Compte tenu des coupures de courant, **un onduleur (UPS) de 1 000 VA minimum**
est le meilleur investissement pour tenir le H24. Un arrêt brutal pendant une
écriture peut corrompre la base. Installez aussi le logiciel de l'onduleur pour
qu'il demande un arrêt propre quand la batterie faiblit.

### 2.4 Maîtriser les redémarrages Windows Update

Windows redémarre volontiers la nuit après une mise à jour. Les services
repartent seuls, mais autant encadrer le moment :

```powershell
# Heures d'activité : pas de redémarrage automatique entre 7h et 20h
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings" `
  -Name "ActiveHoursStart" -Value 7 -Type DWord
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings" `
  -Name "ActiveHoursEnd" -Value 20 -Type DWord
```

### 2.5 Préparer l'arborescence

```powershell
New-Item -ItemType Directory -Force -Path C:\MUFID\app, C:\MUFID\outils, C:\MUFID\journaux
New-Item -ItemType Directory -Force -Path D:\MUFID\sauvegardes, D:\MUFID\pieces-jointes, D:\MUFID\restauration
```

> **S'il n'y a qu'une seule partition** (pas de lecteur `D:`), remplacez partout
> `D:\MUFID` par `C:\MUFID\donnees` dans ce guide. Mieux : profitez-en pour
> créer une partition `D:` d'environ 500 Go dédiée aux données — cela évite
> qu'un disque système plein n'arrête la base.

### 2.6 Ouvrir le pare-feu

```powershell
New-NetFirewallRule -DisplayName "MUFID UNION - HTTPS" -Direction Inbound `
  -Protocol TCP -LocalPort 443 -Action Allow -Profile Domain,Private
New-NetFirewallRule -DisplayName "MUFID UNION - HTTP (redirection)" -Direction Inbound `
  -Protocol TCP -LocalPort 80 -Action Allow -Profile Domain,Private
```

Le port **3306 (base de données) reste fermé** : seule l'application y accède,
depuis la machine elle-même.

### 2.7 Exclusions antivirus

L'antivirus analysant chaque écriture de la base ralentit beaucoup l'ensemble :

```powershell
Add-MpPreference -ExclusionPath "C:\Program Files\MariaDB 11.4\data"
Add-MpPreference -ExclusionPath "C:\MUFID"
Add-MpPreference -ExclusionPath "D:\MUFID"
```

---

## 3. Installer les logiciels

Le plus simple est d'utiliser **winget**, livré avec Windows 10/11 :

```powershell
winget install --id OpenJS.NodeJS.LTS   -e --accept-package-agreements
winget install --id Git.Git             -e --accept-package-agreements
winget install --id MariaDB.Server      -e --accept-package-agreements
winget install --id CaddyServer.Caddy   -e --accept-package-agreements
```

**Fermez puis rouvrez PowerShell**, et vérifiez :

```powershell
node --version    # doit afficher v20 ou v22
npm --version
git --version
caddy version
```

Pendant l'installation de MariaDB, l'assistant demande :
- le **mot de passe root** — notez-le dans votre coffre, il ne sert qu'à
  l'administration ;
- cochez **« Use UTF8 as default server's character set »** ;
- laissez le port **3306** ;
- cochez **« Install as service »**, nom `MariaDB`.

### NSSM — pour transformer l'application en service

```powershell
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" `
                  -OutFile "$env:TEMP\nssm.zip"
Expand-Archive "$env:TEMP\nssm.zip" -DestinationPath "$env:TEMP\nssm" -Force
Copy-Item "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" "C:\MUFID\outils\nssm.exe"
```

> NSSM n'a pas évolué depuis 2017 : c'est un outil **stable et achevé**, encore
> massivement utilisé. Il transforme n'importe quel programme en service
> Windows avec redémarrage automatique et rotation des journaux.

---

## 4. Préparer la base de données

Ouvrez **« MariaDB Command Prompt »** depuis le menu Démarrer, connectez-vous
en root, puis :

```sql
CREATE DATABASE mufid_activites
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Compte applicatif dédié : l'application n'utilise JAMAIS root.
CREATE USER 'mufid_app'@'localhost' IDENTIFIED BY 'UnMotDePasseLongEtUnique';
GRANT ALL PRIVILEGES ON mufid_activites.* TO 'mufid_app'@'localhost';
FLUSH PRIVILEGES;
```

> Ce compte peut créer sa propre base et ses tables, mais **ne peut toucher à
> aucune autre base**. Vérifié en conditions réelles.

### Ajuster MariaDB à 12 Go de RAM

Ouvrez `C:\Program Files\MariaDB 11.4\data\my.ini` dans le Bloc-notes
(en administrateur) et, sous la section `[mysqld]`, ajoutez :

```ini
# Mémoire allouée au cache de données : ~25 % des 12 Go.
innodb_buffer_pool_size = 3G
innodb_log_file_size    = 512M
# Sécurité des écritures : chaque transaction est écrite sur disque.
innodb_flush_log_at_trx_commit = 1
max_connections         = 100
character-set-server    = utf8mb4
collation-server        = utf8mb4_unicode_ci
```

```powershell
Restart-Service MariaDB
```

---

## 5. Installer l'application

```powershell
cd C:\MUFID\app
git clone https://github.com/miky-gif/reporting-it-mufid-union.git .

# Dépendances et compilation de l'interface
cd C:\MUFID\app\backend
npm ci --omit=dev

cd C:\MUFID\app\frontend
npm ci
npm run build
```

> `npm run build` produit `frontend\dist`, que l'application sert directement.
> Comptez 2 à 5 minutes.

### Le fichier de configuration

Créez `C:\MUFID\app\backend\.env` :

```ini
NODE_ENV=production
PORT=8000

# Base de données — reprenez le mot de passe choisi à l'étape 4
DATABASE_URL=mysql://mufid_app:UnMotDePasseLongEtUnique@127.0.0.1:3306/mufid_activites

# Clé de signature des sessions : GÉNÉREZ-EN UNE (commande ci-dessous)
JWT_SECRET=...
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Adresse par laquelle les postes accèdent à la plateforme
CORS_ORIGINS=https://mufid.interne,https://192.168.1.50

# Pièces jointes : sur le disque de données, ou sur le NAS
UPLOADS_DIR=D:\MUFID\pieces-jointes

# E-mail (laisser SMTP_HOST vide désactive l'envoi réel)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=mufidunion1@gmail.com
SMTP_PASS=votre_mot_de_passe_application
MAIL_FROM=MUFID UNION <mufidunion1@gmail.com>
```

Générez la clé de session :

```powershell
# Copiez le résultat dans JWT_SECRET
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

> ⚠ Si `JWT_SECRET` change après la mise en service, **tous les utilisateurs
> sont déconnectés**. On le fixe une fois pour toutes.

Protégez le fichier — il contient des mots de passe :

```powershell
icacls C:\MUFID\app\backend\.env /inheritance:r /grant:r "SYSTEM:(R)" "Administrateurs:(F)"
```

---

## 6. Reprendre les données existantes

Si la plateforme tourne déjà sur un poste de développement, transférez son
contenu. **Sur le poste actuel** :

```powershell
& "C:\xampp\mysql\bin\mysqldump.exe" -u root --single-transaction `
  --default-character-set=utf8mb4 mufid_activites > C:\transfert\mufid.sql
```

Copiez `mufid.sql` **et le dossier des pièces jointes** sur le serveur, puis :

```powershell
cmd /c "\"C:\Program Files\MariaDB 11.4\bin\mariadb.exe\" -u mufid_app -p --default-character-set=utf8mb4 mufid_activites < C:\transfert\mufid.sql"

# Pièces jointes
robocopy C:\transfert\pieces-jointes D:\MUFID\pieces-jointes /E
```

Vérifiez ensuite le nombre d'enregistrements repris :

```sql
SELECT (SELECT COUNT(*) FROM users) AS utilisateurs,
       (SELECT COUNT(*) FROM activites) AS activites,
       (SELECT COUNT(*) FROM departements) AS departements;
```

---

## 7. Premier démarrage et premier compte

Testez **avant** d'en faire un service :

```powershell
cd C:\MUFID\app\backend
npm start
```

Vous devez voir :

```
✔ Base de données connectée et synchronisée.
✔ Planificateur de tâches récurrentes actif (vérification horaire).
✔ MUFID UNION — Reporting IT (production) démarré.
```

Ouvrez `http://localhost:8000` : l'écran de connexion doit apparaître.
Arrêtez avec `Ctrl+C`.

**Si la base est vierge** (pas de reprise de données), créez le premier
compte — il n'y a pas d'inscription publique :

```powershell
cd C:\MUFID\app\backend
node src/creer-super-admin.js --nom "Prénom Nom" `
     --email "admin@mufidunion.cm" --mot-de-passe "UnMotDePasseSolide!2026"
```

Ce script ne crée **qu'un seul compte**, sans aucune donnée de démonstration.

---

## 8. Faire tourner l'application en permanence

```powershell
cd C:\MUFID\outils

.\nssm.exe install MufidUnion "C:\Program Files\nodejs\node.exe"
.\nssm.exe set MufidUnion AppParameters "src\index.js"
.\nssm.exe set MufidUnion AppDirectory "C:\MUFID\app\backend"
.\nssm.exe set MufidUnion DisplayName "MUFID UNION - Plateforme de reporting IT"
.\nssm.exe set MufidUnion Description "API et interface de reporting d'activites IT"
.\nssm.exe set MufidUnion Start SERVICE_AUTO_START

# Redémarrage automatique en cas d'arrêt inattendu
.\nssm.exe set MufidUnion AppExit Default Restart
.\nssm.exe set MufidUnion AppRestartDelay 5000
.\nssm.exe set MufidUnion AppThrottle 10000

# Journaux, avec rotation quotidienne et au-delà de 10 Mo
.\nssm.exe set MufidUnion AppStdout "C:\MUFID\journaux\application.log"
.\nssm.exe set MufidUnion AppStderr "C:\MUFID\journaux\erreurs.log"
.\nssm.exe set MufidUnion AppRotateFiles 1
.\nssm.exe set MufidUnion AppRotateOnline 1
.\nssm.exe set MufidUnion AppRotateSeconds 86400
.\nssm.exe set MufidUnion AppRotateBytes 10485760

# La base doit être prête avant l'application
.\nssm.exe set MufidUnion DependOnService MariaDB

Start-Service MufidUnion
Get-Service MufidUnion
```

> ⚠ **Une seule instance, jamais plus.** L'application génère les tâches
> récurrentes toutes les heures ; deux instances créeraient des doublons.

---

## 9. Accès propre et chiffré

Copiez la configuration fournie et adaptez-la :

```powershell
Copy-Item C:\MUFID\app\exploitation\Caddyfile C:\MUFID\outils\Caddyfile
notepad C:\MUFID\outils\Caddyfile
```

Remplacez la première ligne par **votre** nom et **votre** adresse, par exemple
`mufid.interne, 192.168.1.50`. Puis installez le service :

```powershell
cd C:\MUFID\outils
$caddy = (Get-Command caddy).Source

.\nssm.exe install MufidWeb $caddy
.\nssm.exe set MufidWeb AppParameters "run --config C:\MUFID\outils\Caddyfile"
.\nssm.exe set MufidWeb AppDirectory "C:\MUFID\outils"
.\nssm.exe set MufidWeb DisplayName "MUFID UNION - Frontal web"
.\nssm.exe set MufidWeb Start SERVICE_AUTO_START
.\nssm.exe set MufidWeb AppExit Default Restart
.\nssm.exe set MufidWeb AppStdout "C:\MUFID\journaux\web.log"
.\nssm.exe set MufidWeb AppStderr "C:\MUFID\journaux\web-erreurs.log"
.\nssm.exe set MufidWeb AppRotateFiles 1
.\nssm.exe set MufidWeb DependOnService MufidUnion

Start-Service MufidWeb
```

### Nom lisible sur le réseau

Pour que `https://mufid.interne` fonctionne, demandez à votre administrateur
réseau d'ajouter un enregistrement DNS interne. **Sans serveur DNS**, ajoutez
la ligne suivante au fichier `C:\Windows\System32\drivers\etc\hosts` **de
chaque poste IT** :

```
192.168.1.50    mufid.interne
```

### Certificat interne sur les postes

Caddy crée sa propre autorité de certification. Sans l'installer, les
navigateurs afficheront un avertissement. Récupérez le fichier :

```
C:\Windows\System32\config\systemprofile\AppData\Roaming\Caddy\pki\authorities\local\root.crt
```

Copiez-le sur chaque poste IT, double-cliquez dessus → **Installer le
certificat** → **Ordinateur local** → **Placer dans : Autorités de
certification racines de confiance**. Opération unique, deux minutes par poste.

---

## 10. Sauvegardes automatiques

Le script est déjà fourni : `C:\MUFID\app\exploitation\sauvegarde-base.ps1`.
Il lit les identifiants dans le `.env`, produit une archive compressée
horodatée, garde **30 sauvegardes quotidiennes** et **12 archives mensuelles**,
et consigne tout dans un journal.

### Essai manuel

```powershell
powershell -ExecutionPolicy Bypass -File C:\MUFID\app\exploitation\sauvegarde-base.ps1
Get-ChildItem D:\MUFID\sauvegardes\quotidiennes
```

### Planification quotidienne

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\MUFID\app\exploitation\sauvegarde-base.ps1"

# Tous les jours à 2 h du matin
$declencheur = New-ScheduledTaskTrigger -Daily -At 2:00AM

$reglages = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName "MUFID - Sauvegarde base" `
  -Action $action -Trigger $declencheur -Settings $reglages `
  -User "SYSTEM" -RunLevel Highest `
  -Description "Sauvegarde quotidienne de la base MUFID UNION avec rotation"

# Déclenchement immédiat pour vérifier
Start-ScheduledTask -TaskName "MUFID - Sauvegarde base"
Get-ScheduledTaskInfo -TaskName "MUFID - Sauvegarde base"
```

`-StartWhenAvailable` garantit le rattrapage si la machine était éteinte à 2 h.

### Sauvegarde des pièces jointes

Les fichiers joints ne sont pas dans la base. Ajoutez une seconde tâche
hebdomadaire :

```powershell
$a = New-ScheduledTaskAction -Execute "robocopy.exe" `
  -Argument "D:\MUFID\pieces-jointes D:\MUFID\sauvegardes\pieces-jointes /MIR /R:2 /W:5 /NP"
$d = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3:00AM
Register-ScheduledTask -TaskName "MUFID - Sauvegarde pieces jointes" `
  -Action $a -Trigger $d -User "SYSTEM" -RunLevel Highest
```

### ⚠ Le point le plus important

**Une sauvegarde sur la même machine ne protège de rien** en cas de vol,
d'incendie ou de panne du disque. Faites **recopier chaque semaine** le dossier
`D:\MUFID\sauvegardes` vers le NAS de l'entreprise ou un disque externe
conservé ailleurs. Et **testez une restauration tous les trimestres** — une
sauvegarde jamais restaurée n'est pas une sauvegarde.

Pour restaurer :

```powershell
powershell -ExecutionPolicy Bypass -File C:\MUFID\app\exploitation\restaurer-base.ps1 `
           -Archive D:\MUFID\sauvegardes\quotidiennes\mufid_2026-10-02_0200.zip
```

Ce script effectue d'abord une sauvegarde de l'état courant, puis demande
confirmation avant de remplacer quoi que ce soit.

---

## 11. Recette — à faire avant d'annoncer la mise en service

| # | Vérification | Attendu |
|---|---|---|
| 1 | `Get-Service MariaDB, MufidUnion, MufidWeb` | les trois `Running` |
| 2 | `https://mufid.interne` depuis un poste IT | écran de connexion, cadenas valide |
| 3 | Connexion avec le compte super admin | accès au tableau de bord |
| 4 | Créer un département, un agent, une activité | tout s'enregistre |
| 5 | Joindre un fichier à une activité | le fichier apparaît dans `D:\MUFID\pieces-jointes` |
| 6 | Exporter un rapport en PDF, Word et Excel | les trois fichiers se téléchargent |
| 7 | `Restart-Computer` puis attendre 3 minutes | la plateforme répond **sans aucune intervention** |
| 8 | `Stop-Process -Name node -Force` | le service redémarre seul en 5 s |
| 9 | `Start-ScheduledTask "MUFID - Sauvegarde base"` | une archive apparaît |
| 10 | Restaurer cette archive sur une base d'essai | les données reviennent |

Les points **7 et 8** répondent précisément à votre exigence : la plateforme se
relève seule, après un redémarrage comme après un incident.

---

## 12. Exploitation courante

### Mettre à jour la plateforme

```powershell
Stop-Service MufidUnion

cd C:\MUFID\app
git pull
cd backend;  npm ci --omit=dev
cd ..\frontend; npm ci; npm run build

Start-Service MufidUnion
```

Les évolutions de schéma s'appliquent **automatiquement** au démarrage, sans
effacer de données. Coupure : moins d'une minute.

> Faites toujours une sauvegarde manuelle avant une mise à jour importante.

### Commandes utiles

```powershell
Get-Service Mufid*                                   # état des services
Get-Content C:\MUFID\journaux\application.log -Tail 50 -Wait   # journal en direct
Get-Content C:\MUFID\journaux\erreurs.log -Tail 50
Restart-Service MufidUnion                           # redémarrage applicatif
Get-Content D:\MUFID\sauvegardes\journal-sauvegardes.log -Tail 20
```

### Surveillance mensuelle (10 minutes)

1. Les trois services tournent-ils ?
2. Le journal des sauvegardes affiche-t-il un succès chaque jour ?
3. Combien d'espace reste-t-il ? `Get-PSDrive C, D`
4. `erreurs.log` contient-il des messages répétés ?
5. La copie hors machine des sauvegardes est-elle à jour ?

---

## 13. Dépannage

**La plateforme ne répond plus**
```powershell
Get-Service MariaDB, MufidUnion, MufidWeb
Get-Content C:\MUFID\journaux\erreurs.log -Tail 40
Restart-Service MufidUnion
```

**« Impossible de se connecter à la base de données »**
→ `Get-Service MariaDB`. Si elle est arrêtée : `Start-Service MariaDB`.
Sinon, vérifiez `DATABASE_URL` dans le `.env` (mot de passe, nom de la base).

**Le navigateur affiche un avertissement de sécurité**
→ Le certificat racine de Caddy n'est pas installé sur ce poste (étape 9).

**Une pièce jointe refuse de se téléverser**
→ Vérifiez que `D:\MUFID\pieces-jointes` existe et que le compte `SYSTEM` y a
les droits d'écriture. Au-delà de 10 Mo, le fichier est refusé — c'est voulu.

**Le service redémarre en boucle**
→ `Get-Content C:\MUFID\journaux\erreurs.log -Tail 60`. Le plus souvent, une
variable manquante dans le `.env`, ou le port 8000 déjà occupé :
`Get-NetTCPConnection -LocalPort 8000`.

**Les tâches récurrentes se dupliquent**
→ Deux instances tournent. `Get-Process node` : il ne doit y en avoir **qu'une**.

---

## 14. Récapitulatif avant mise en service

- [ ] Machine renommée, adresse IP fixe
- [ ] Veille et hibernation désactivées, redémarrage auto après coupure (BIOS)
- [ ] Onduleur installé et testé
- [ ] MariaDB installée, base et compte applicatif créés, `my.ini` ajusté
- [ ] `.env` complété, `JWT_SECRET` généré, droits du fichier restreints
- [ ] Interface compilée (`npm run build`)
- [ ] Données reprises et comptées
- [ ] Compte super administrateur créé, mot de passe changé
- [ ] Services `MufidUnion` et `MufidWeb` installés en démarrage automatique
- [ ] Pare-feu ouvert sur 80 et 443 uniquement
- [ ] Certificat racine installé sur les postes IT
- [ ] Sauvegarde quotidienne planifiée **et testée**
- [ ] Copie des sauvegardes **hors de la machine** organisée
- [ ] Les 10 points de recette passés, dont le redémarrage complet
- [ ] Mots de passe consignés dans le coffre de l'entreprise

---

## Annexe — ce qui tourne, et où

| Élément | Emplacement |
|---|---|
| Code de l'application | `C:\MUFID\app` |
| Configuration (secrets) | `C:\MUFID\app\backend\.env` |
| Scripts d'exploitation | `C:\MUFID\app\exploitation\` |
| Outils (NSSM, Caddyfile) | `C:\MUFID\outils` |
| Journaux | `C:\MUFID\journaux` |
| Données MariaDB | `C:\Program Files\MariaDB 11.4\data` |
| Pièces jointes | `D:\MUFID\pieces-jointes` |
| Sauvegardes | `D:\MUFID\sauvegardes` |

**Ports** : 443 et 80 ouverts sur le réseau · 8000 et 3306 en local uniquement.
