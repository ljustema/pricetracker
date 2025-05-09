"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>("");
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState("");

  // Check if this is a confirmation link with token
  useEffect(() => {
    const token = searchParams?.get("token");
    const type = searchParams?.get("type");
    
    if (token && type === "signup") {
      handleConfirmation(token);
    }
  }, [searchParams]);

  // Handle email confirmation
  const handleConfirmation = async (token: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "signup",
      });

      if (error) {
        throw error;
      }

      // Redirect to login after successful confirmation
      router.push("/auth-routes/login?confirmed=true");
    } catch (error) {
      console.error("Error confirming email:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred during email confirmation. Please try again."
      );
    }
  };

  // Handle resend confirmation email
  const handleResendConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResending(true);
    setError("");
    setResendSuccess(false);

    if (!email) {
      setError("Please enter your email address");
      setIsResending(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-routes/login`,
        },
      });

      if (error) {
        throw error;
      }

      setResendSuccess(true);
    } catch (error) {
      console.error("Error resending confirmation email:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while resending the confirmation email. Please try again."
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">PriceTracker</h2>
          <p className="mt-2 text-sm text-gray-600">
            Email Confirmation Required
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          {resendSuccess ? (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Confirmation email sent!
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>
                      Please check your email inbox and follow the instructions to
                      confirm your account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="mt-3 text-lg font-medium text-gray-900">
                  Check your email
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  We've sent you a confirmation email. Please check your inbox and
                  click the link to verify your account.
                </p>
              </div>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500">
                      Didn't receive an email?
                    </span>
                  </div>
                </div>

                <form className="mt-6 space-y-6" onSubmit={handleResendConfirmation}>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Email address
                    </label>
                    <div className="mt-1">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={isResending}
                      className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      {isResending ? "Sending..." : "Resend confirmation email"}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-600">
              <Link
                href="/auth-routes/login"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Return to login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
