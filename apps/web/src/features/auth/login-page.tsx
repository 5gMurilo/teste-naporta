import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/error-message';
import { ApiError, isAbortError } from '@/lib/http-client';
import { useSession } from './session-provider';

type FieldErrors = { email?: string; password?: string };

const MESSAGES = {
  emailRequired: 'Informe o e-mail.',
  emailInvalid: 'Informe um e-mail válido.',
  passwordRequired: 'Informe a senha.',
  invalidCredentials: 'E-mail ou senha incorretos.',
  invalidData: 'Verifique os dados informados.',
  rateLimited: 'Muitas tentativas de entrada. Aguarde um minuto e tente novamente.',
  expired: 'Sua sessão expirou. Entre novamente.',
} as const;

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (email.trim() === '') errors.email = MESSAGES.emailRequired;
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = MESSAGES.emailInvalid;
  if (password === '') errors.password = MESSAGES.passwordRequired;
  return errors;
}

function fieldErrorsFrom(error: ApiError): FieldErrors {
  const errors: FieldErrors = {};
  for (const { field } of error.errors) {
    if (field === 'email') errors.email = MESSAGES.emailInvalid;
    if (field === 'password') errors.password = MESSAGES.passwordRequired;
  }
  return errors;
}

export function LoginPage() {
  const { state, login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const submitting = useRef(false);
  const mounted = useRef(true);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function focusFirstInvalid(errors: FieldErrors) {
    (errors.email ? emailInput : passwordInput).current?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const errors = validate(email, password);
    setFormError(undefined);
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      focusFirstInvalid(errors);
      return;
    }

    submitting.current = true;
    setPending(true);
    try {
      await login({ email, password });
    } catch (error) {
      if (!mounted.current || isAbortError(error)) return;
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setFormError(MESSAGES.invalidCredentials);
        passwordInput.current?.focus();
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError(MESSAGES.rateLimited);
      } else if (error instanceof ApiError && error.status === 400) {
        const errorsFromApi = fieldErrorsFrom(error);
        setFieldErrors(errorsFromApi);
        setFormError(MESSAGES.invalidData);
        focusFirstInvalid(errorsFromApi);
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }

  const expired = state.status === 'anonymous' && state.expired;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <p className="text-muted-foreground text-sm font-medium">naPorta</p>
          <CardTitle>
            <h1 className="text-2xl font-semibold">Entrar</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expired && !formError && (
            <p role="status" className="bg-muted mb-4 rounded-md p-3 text-sm">
              {MESSAGES.expired}
            </p>
          )}
          {formError && (
            <p role="alert" className="text-destructive mb-4 text-sm font-medium">
              {formError}
            </p>
          )}
          <form onSubmit={onSubmit} noValidate aria-busy={pending} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="login-email">E-mail</Label>
              <Input
                id="login-email"
                ref={emailInput}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              />
              {fieldErrors.email && (
                <p id="login-email-error" className="text-destructive text-sm">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-password">Senha</Label>
              <Input
                id="login-password"
                ref={passwordInput}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              />
              {fieldErrors.password && (
                <p id="login-password-error" className="text-destructive text-sm">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
