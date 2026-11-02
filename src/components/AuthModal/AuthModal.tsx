import { useEffect, useRef, useState } from "react";
import { useCard } from "../../state/CardContext";
import "./AuthModal.css";

type Mode = "login" | "register";

const MIN_PASSWORD_LENGTH = 8;

function AuthModal() {
  const { state, dispatch, login, register } = useCard();
  const { open, reason, next } = state.authPrompt;

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setError("");
      setTimeout(() => emailRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) dispatch({ type: "CLOSE_AUTH" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, dispatch]);

  if (!open) return null;

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  const onClose = () => {
    if (!submitting) dispatch({ type: "CLOSE_AUTH" });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password);

      dispatch({ type: "CLOSE_AUTH" });
      if (next === "checkout") {
        dispatch({ type: "TOGGLE_CART", payload: false });
        dispatch({ type: "TOGGLE_CHECKOUT", payload: true });
      } else if (next === "orders") {
        dispatch({ type: "TOGGLE_ORDER_HISTORY", payload: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <>
      <div className="auth-overlay" onClick={onClose} />
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="auth-modal__header">
          <h2 className="auth-modal__title" id="auth-title">
            {isLogin ? "Log in" : "Create an account"}
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className="auth-modal__body" onSubmit={onSubmit}>
          {reason && <p className="auth-modal__reason">{reason}</p>}

          <label className="auth-field">
            <span className="auth-field__label">Email</span>
            <input
              ref={emailRef}
              className="auth-field__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-field__label">Password</span>
            <input
              className="auth-field__input"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={isLogin ? undefined : MIN_PASSWORD_LENGTH}
              required
            />
            {!isLogin && (
              <span className="auth-field__hint">At least {MIN_PASSWORD_LENGTH} characters</span>
            )}
          </label>

          {!isLogin && (
            <label className="auth-field">
              <span className="auth-field__label">Confirm password</span>
              <input
                className="auth-field__input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
          )}

          {error && (
            <p className="auth-modal__error" role="alert">
              {error}
            </p>
          )}

          <button className="auth-modal__submit" type="submit" disabled={submitting}>
            {submitting
              ? isLogin
                ? "Logging in…"
                : "Creating account…"
              : isLogin
                ? "Log in"
                : "Create account"}
          </button>

          <p className="auth-modal__switch">
            {isLogin ? "New to GearHub?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="auth-modal__switch-btn"
              onClick={() => switchMode(isLogin ? "register" : "login")}
              disabled={submitting}
            >
              {isLogin ? "Create an account" : "Log in"}
            </button>
          </p>
        </form>
      </div>
    </>
  );
}

export default AuthModal;
