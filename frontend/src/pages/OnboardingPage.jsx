/**
 * OnboardingPage.jsx
 * Step-by-step onboarding flow for new users.
 * Step 1: Choose role (Host or Guest)
 * Step 2: Tavus AI video agent conversation
 * Step 3: Review & confirm extracted profile data
 * Step 4: Redirect to matches
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TavusVideoAgent from '../components/TavusVideoAgent';
import api from '../api/client';
import { useAppStore } from '../store/appStore';

const STEPS = {
  CHOOSE_ROLE:    'choose_role',
  AI_INTERVIEW:   'ai_interview',
  REVIEW_PROFILE: 'review_profile',
  COMPLETE:       'complete',
};

export default function OnboardingPage() {
  const navigate    = useNavigate();
  const { setUser } = useAppStore();

  const [step,          setStep]          = useState(STEPS.CHOOSE_ROLE);
  const [role,          setRole]          = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [saving,        setSaving]        = useState(false);

  // -----------------------------------------------------------------------
  // Role selection
  // -----------------------------------------------------------------------
  const handleRoleSelect = async (selectedRole) => {
    setRole(selectedRole);
    // Save role to backend
    await api.patch('/users/me', { role: selectedRole });
    setStep(STEPS.AI_INTERVIEW);
  };

  // -----------------------------------------------------------------------
  // Tavus conversation complete
  // -----------------------------------------------------------------------
  const handleConversationComplete = (data) => {
    setExtractedData(data);
    setStep(STEPS.REVIEW_PROFILE);
  };

  // -----------------------------------------------------------------------
  // Confirm profile
  // -----------------------------------------------------------------------
  const handleConfirmProfile = async () => {
    try {
      setSaving(true);
      const { data: updatedUser } = await api.patch('/users/me', {
        onboardingCompleted: true,
      });
      setUser(updatedUser);
      setStep(STEPS.COMPLETE);
      setTimeout(() => navigate('/matches'), 2000);
    } catch (err) {
      console.error('Error confirming profile:', err);
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 to-teal-50">
      {/* Progress indicator */}
      <div className="max-w-2xl mx-auto pt-8 px-4">
        <div className="flex items-center gap-2 mb-8">
          {[STEPS.CHOOSE_ROLE, STEPS.AI_INTERVIEW, STEPS.REVIEW_PROFILE].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ' +
                (step === s
                  ? 'bg-teal-600 text-white'
                  : [STEPS.AI_INTERVIEW, STEPS.REVIEW_PROFILE, STEPS.COMPLETE].indexOf(step) > i
                    ? 'bg-teal-200 text-teal-800'
                    : 'bg-gray-200 text-gray-500')
              }>
                {i + 1}
              </div>
              {i < 2 && <div className="w-12 h-0.5 bg-gray-200 mx-1" />}
            </div>
          ))}
          <span className="ml-2 text-sm text-gray-500">
            {step === STEPS.CHOOSE_ROLE    && 'Choose your role'}
            {step === STEPS.AI_INTERVIEW   && 'Chat with Haven'}
            {step === STEPS.REVIEW_PROFILE && 'Review your profile'}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-16">

        {/* Step 1: Choose role */}
        {step === STEPS.CHOOSE_ROLE && (
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome to HomeShare</h1>
            <p className="text-gray-600 mb-10">
              First, tell us how you'd like to use HomeShare.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Host card */}
              <button
                onClick={() => handleRoleSelect('host')}
                className="p-8 bg-white rounded-2xl border-2 border-transparent hover:border-teal-400 
                           shadow-sm hover:shadow-md transition-all text-left group"
              >
                <div className="w-14 h-14 mb-4 rounded-full bg-amber-100 flex items-center justify-center
                                group-hover:bg-amber-200 transition-colors">
                  <span className="text-2xl">🏠</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">I'm a Host</h3>
                <p className="text-gray-500 text-sm">
                  I have extra space at home and would love to rent a room to a kind, trustworthy person.
                </p>
              </button>

              {/* Guest card */}
              <button
                onClick={() => handleRoleSelect('guest')}
                className="p-8 bg-white rounded-2xl border-2 border-transparent hover:border-teal-400 
                           shadow-sm hover:shadow-md transition-all text-left group"
              >
                <div className="w-14 h-14 mb-4 rounded-full bg-sky-100 flex items-center justify-center
                                group-hover:bg-sky-200 transition-colors">
                  <span className="text-2xl">🎒</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">I'm a Guest</h3>
                <p className="text-gray-500 text-sm">
                  I'm looking for an affordable, flexible place to live with a welcoming homeowner.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Tavus AI Interview */}
        {step === STEPS.AI_INTERVIEW && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Chat with Haven
              </h1>
              <p className="text-gray-600">
                Haven is going to ask you a few friendly questions to understand who you are 
                and what you're looking for. Just talk naturally — it only takes about 5 minutes.
              </p>
            </div>
            <TavusVideoAgent onConversationComplete={handleConversationComplete} />
          </div>
        )}

        {/* Step 3: Review profile */}
        {step === STEPS.REVIEW_PROFILE && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Review Your Profile</h1>
              <p className="text-gray-600">
                Here's what Haven learned about you. Everything looks right? Let's go find some matches!
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              {extractedData ? (
                <div className="space-y-4">
                  <ProfileRow label="Role"     value={role === 'host' ? 'Host (listing a room)' : 'Guest (seeking a room)'} />
                  {extractedData.budget && (
                    <ProfileRow label="Budget"  value={'$' + extractedData.budget + ' / month'} />
                  )}
                  {extractedData.helperExchange && (
                    <ProfileRow label="Helper Exchange" value="Open to it" />
                  )}
                  {Object.keys(extractedData.lifestyle || {}).length > 0 && (
                    <ProfileRow
                      label="Lifestyle"
                      value={Object.keys(extractedData.lifestyle).join(', ')}
                    />
                  )}
                  {extractedData.houseRules?.length > 0 && (
                    <ProfileRow label="Rules"   value={extractedData.houseRules.join(', ')} />
                  )}
                  {extractedData.bio && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-sm text-gray-500 mb-1">About you</p>
                      <p className="text-gray-700 text-sm italic">"{extractedData.bio}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  We'll build your profile from what Haven captured.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmProfile}
                disabled={saving}
                className="w-full py-3 bg-teal-600 text-white rounded-full font-medium 
                           hover:bg-teal-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Looks great — show me my matches!'}
              </button>
              <button
                onClick={() => setStep(STEPS.AI_INTERVIEW)}
                className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                Chat with Haven again
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === STEPS.COMPLETE && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-teal-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">You're all set!</h2>
            <p className="text-gray-600">Finding your best matches now...</p>
            <div className="mt-6 flex justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 font-medium w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right">{value}</span>
    </div>
  );
}
