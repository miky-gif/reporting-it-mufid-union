import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CategoriesProvider } from "@/context/CategoriesContext";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  RequireAdmin,
  RequireAuth,
  RequirePermission,
  RequireSuperAdmin,
} from "@/components/RouteGuards";

import Login from "@/pages/Login";
import EmployeeDashboard from "@/pages/EmployeeDashboard";
import ActivityForm from "@/pages/ActivityForm";
import MyActivities from "@/pages/MyActivities";
import Profile from "@/pages/Profile";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ActivitiesManagement from "@/pages/admin/ActivitiesManagement";
import AdminTaskForm from "@/pages/admin/AdminTaskForm";
import IndividualReports from "@/pages/admin/IndividualReports";
import ConsolidatedReports from "@/pages/admin/ConsolidatedReports";
import Statistics from "@/pages/admin/Statistics";
import UsersPage from "@/pages/admin/Users";
import CategoriesManagement from "@/pages/admin/CategoriesManagement";
import Departements from "@/pages/admin/Departements";

/** L'accueil « / » : dashboard employé, ou redirection admin. */
function Accueil() {
  const { estAdmin } = useAuth();
  return estAdmin ? <Navigate to="/admin" replace /> : <EmployeeDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <CategoriesProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              {/* Espace employé */}
              <Route path="/" element={<Accueil />} />
              <Route path="/activites" element={<MyActivities />} />
              <Route path="/activites/nouvelle" element={<ActivityForm />} />
              <Route path="/activites/:id/modifier" element={<ActivityForm />} />
              <Route path="/profil" element={<Profile />} />

              {/* Espace administration (admin de département ou super admin) */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/activites" element={<ActivitiesManagement />} />
                <Route path="/admin/utilisateurs" element={<UsersPage />} />

                {/* Écrans soumis à un droit précis */}
                <Route element={<RequirePermission droit="TACHES_AFFECTER" />}>
                  <Route path="/admin/taches/nouvelle" element={<AdminTaskForm />} />
                </Route>
                <Route element={<RequirePermission droit="STATISTIQUES_VOIR" />}>
                  <Route path="/admin/statistiques" element={<Statistics />} />
                </Route>
                <Route element={<RequirePermission droit="RAPPORTS_EXPORTER" />}>
                  <Route path="/admin/rapports/individuel" element={<IndividualReports />} />
                  <Route path="/admin/rapports/consolide" element={<ConsolidatedReports />} />
                </Route>
                <Route element={<RequirePermission droit="CATEGORIES_GERER" />}>
                  <Route path="/admin/categories" element={<CategoriesManagement />} />
                </Route>

                {/* Réservé au super administrateur */}
                <Route element={<RequireSuperAdmin />}>
                  <Route path="/admin/departements" element={<Departements />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CategoriesProvider>
    </AuthProvider>
  );
}
