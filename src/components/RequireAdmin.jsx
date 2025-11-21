import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const RequireAdmin = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "Admin" && user.role !== "SuperAdmin") return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default RequireAdmin;
