import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { LogIn, Shield } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, verifyTOTP } = useStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auth flow state
  const [userId, setUserId] = useState('');
  const [requiresTOTP, setRequiresTOTP] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);

      if (result.requiresTOTP) {
        // User has TOTP enabled, show TOTP input
        setUserId(result.userId);
        setRequiresTOTP(true);
      } else if (result.requiresTOTPSetup) {
        // User needs to set up TOTP, redirect to setup page
        navigate('/totp-setup', { state: { userId: result.userId, username: result.username } });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verifyTOTP(userId, totpToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Invalid TOTP code');
      setTotpToken('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Daly<span className="text-primary-500">Kraken</span>
          </h1>
          <p className="text-gray-400">
            {requiresTOTP ? 'Two-Factor Authentication' : 'Sign in to your account'}
          </p>
        </div>

        <div className="card">
          {!requiresTOTP ? (
            // Username/Password Form
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="Enter username"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="Enter password"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary flex items-center justify-center"
              >
                {loading ? (
                  <div className="spinner w-5 h-5 border-2"></div>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Sign In
                  </>
                )}
              </button>

              <div className="text-center text-sm text-gray-400 mt-4">
                <p className="flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  Secured with Google Authenticator
                </p>
              </div>
            </form>
          ) : (
            // TOTP Verification Form
            <form onSubmit={handleTOTPVerify} className="space-y-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-full mb-3">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-gray-300">Enter the 6-digit code from your authenticator app</p>
              </div>

              {error && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  Authentication Code
                </label>
                <input
                  type="text"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center text-2xl tracking-widest"
                  placeholder="000000"
                  required
                  disabled={loading}
                  maxLength={6}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || totpToken.length !== 6}
                className="w-full btn btn-primary flex items-center justify-center"
              >
                {loading ? (
                  <div className="spinner w-5 h-5 border-2"></div>
                ) : (
                  <>
                    <Shield className="mr-2 h-5 w-5" />
                    Verify Code
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setRequiresTOTP(false);
                  setTotpToken('');
                  setError('');
                }}
                className="w-full text-sm text-gray-400 hover:text-white transition-colors"
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
