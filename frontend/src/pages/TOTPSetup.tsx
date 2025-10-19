import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Shield, Check, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function TOTPSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setupTOTP, confirmTOTPSetup } = useStore();

  const { userId, username } = location.state || {};

  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'setup' | 'verify'>('setup');

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    const initSetup = async () => {
      try {
        const response = await setupTOTP(userId);
        if (response.success) {
          setQrCode(response.qrCode);
          setSecret(response.secret);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to generate QR code');
      }
    };

    initSetup();
  }, [userId, setupTOTP, navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await confirmTOTPSetup(userId, secret, totpToken);
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
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Set Up Two-Factor Authentication
          </h1>
          <p className="text-gray-400">Secure your account with Google Authenticator</p>
        </div>

        <div className="card">
          {step === 'setup' ? (
            // QR Code Display
            <div className="space-y-6">
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-400" />
                  Step 1: Download Google Authenticator
                </h3>
                <p className="text-sm text-gray-300">
                  If you haven't already, download Google Authenticator from your app store:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-400">
                  <li>• iOS: App Store</li>
                  <li>• Android: Google Play Store</li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 text-center">
                  Step 2: Scan QR Code
                </h3>
                {qrCode ? (
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-4 rounded-lg">
                      <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                    </div>
                    <p className="mt-4 text-sm text-gray-400 text-center">
                      Scan this QR code with Google Authenticator
                    </p>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div className="spinner w-8 h-8 border-2"></div>
                  </div>
                )}
              </div>

              {secret && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-yellow-200 mb-2">
                    Can't scan? Enter this code manually:
                  </h3>
                  <div className="bg-black/30 rounded p-3 font-mono text-sm text-white text-center break-all">
                    {secret}
                  </div>
                  <p className="mt-2 text-xs text-yellow-200/70">
                    Save this code somewhere safe. You'll need it to recover your account if you lose access to your authenticator app.
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <button
                onClick={() => setStep('verify')}
                disabled={!qrCode}
                className="w-full btn btn-primary flex items-center justify-center"
              >
                Continue to Verification
              </button>
            </div>
          ) : (
            // Verification Form
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-600 rounded-full mb-3">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Step 3: Verify Setup
                </h3>
                <p className="text-sm text-gray-300">
                  Enter the 6-digit code from your authenticator app to confirm setup
                </p>
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
                    Complete Setup
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('setup');
                  setTotpToken('');
                  setError('');
                }}
                className="w-full text-sm text-gray-400 hover:text-white transition-colors"
              >
                Back to QR code
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Account: <span className="text-gray-300">{username}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
