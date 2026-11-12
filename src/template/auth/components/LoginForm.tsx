import { useState } from "react";
import { Link } from "react-router";
import { IconMail, IconLock, IconEye, IconEyeOff } from "@tabler/icons-react";
import { useLoginForm } from "../hooks";
import { configServer } from "@/config/ConfigServer";
import { Input, Label, Button, Checkbox, Alert } from "@/components/ui";

export function LoginForm() {
  const { formData, isLoading, error, handleChange, handleSubmit, clearError } =
    useLoginForm();
  const { useAuthConfig } = configServer();
  const [verPassword, setVerPassword] = useState(false);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="error" onClose={clearError}>
          {error}
        </Alert>
      )}

      <div>
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={formData.email}
          onChange={handleChange}
          leftIcon={<IconMail className="h-5 w-5" />}
          placeholder="tu@email.com"
        />
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type={verPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={formData.password}
          onChange={handleChange}
          leftIcon={<IconLock className="h-5 w-5" />}
          placeholder="••••••••"
          rightAction={
            <button
              type="button"
              onClick={() => setVerPassword(v => !v)}
              aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="p-1.5 rounded-md text-text-300 hover:text-text-100 hover:bg-bg-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
            >
              {verPassword ? <IconEyeOff size={18} stroke={1.7} /> : <IconEye size={18} stroke={1.7} />}
            </button>
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Checkbox
          id="rememberMe"
          name="rememberMe"
          checked={formData.rememberMe}
          onChange={handleChange}
          label="Recordarme"
        />

        <Link
          to={useAuthConfig.AUTH_FORGOT_PASSWORD_PATH}
          className="text-sm font-medium text-blue-400 hover:text-blue-500"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <Button
        type="submit"
        variant="solid"
        fullWidth
        isLoading={isLoading}
        loadingText="Iniciando sesión..."
      >
        Iniciar sesión
      </Button>
    </form>
  );
}
