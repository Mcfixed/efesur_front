import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router";
import Template from "./layouts/Template";
import { ThemeProvider } from "./context/ThemeContext";
import { configServer } from "@/config/ConfigServer";
import {
  AuthProvider,
  ProtectedRoute,
  PublicOnlyRoute,
} from "@/libs/better-auth";
import { QueryProvider } from "@/libs/tanstack-query";
import { ToastProvider } from "@/libs/sonner";
import { LoginPage, RegisterPage, ForgotPasswordPage } from "@/template/auth";

const { useConfigApp, useAuthConfig } = configServer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider />
            <Routes>
              <Route
                path={useAuthConfig.AUTH_LOGIN_PATH}
                element={
                  <PublicOnlyRoute redirectTo="/">
                    <LoginPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path={useAuthConfig.AUTH_REGISTER_PATH}
                element={
                  <PublicOnlyRoute redirectTo="/">
                    <RegisterPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path={useAuthConfig.AUTH_FORGOT_PASSWORD_PATH}
                element={
                  <PublicOnlyRoute redirectTo="/">
                    <ForgotPasswordPage />
                  </PublicOnlyRoute>
                }
              />

              {/* Rutas protegidas */}
              <Route
                element={
                  <ProtectedRoute redirectTo={useAuthConfig.AUTH_LOGIN_PATH}>
                    <Template />
                  </ProtectedRoute>
                }
              >
                {useConfigApp.NAVIGATION_APP.map((item) => (
                  <Route key={item.id} path={item.link} element={<item.component />} />
                ))}

                {/* Rutas del template (Header/UserMenu) */}
                {useConfigApp.TEMPLATE_ROUTES?.map((item) => (
                  <Route
                    key={item.id}
                    path={item.link}
                    element={<item.component />}
                  />
                ))}
              </Route>
            </Routes>
          </ThemeProvider>
        </AuthProvider>
        {/* <ReactQueryDevtools initialIsOpen={false} /> */}
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>,
);
