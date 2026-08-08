"use client";

import { FormEvent, useState } from "react";
import type { ReactElement } from "react";
import { requestStudentIdUploadUrl, uploadStudentIdFile } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  setContactField,
  setFormField,
  setStep,
  setStudentIdFile,
} from "@/lib/registration-slice";

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 shrink-0">
      <circle cx="12" cy="8" r="3.4" />
      <path strokeLinecap="round" d="M5 20c0-3.6 3.1-6.3 7-6.3s7 2.7 7 6.3" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5v10.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 6.75 8.25 6.75 8.25-6.75" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 shrink-0">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 3.5h2l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v2a2 2 0 0 1-2 2C10.5 17.5 6.5 13.5 4.5 7.5a2 2 0 0 1 2-4Z"
      />
    </svg>
  );
}

function InstitutionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V10m16 11V10M3 10l9-6 9 6M6 10v7m4-7v7m4-7v7m4-7v7" />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 shrink-0">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path strokeLinecap="round" d="M7.5 17c0-2 2-3.2 4.5-3.2s4.5 1.2 4.5 3.2" />
    </svg>
  );
}

function IndustryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V10l6 4v-4l6 4V6l6 4v11H3Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5v6M7.5 7.75v.01M11.5 16.5v-3.5c0-1.4 1-2 2-2s2 .8 2 2.2v3.3" />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 shrink-0">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 18a4 4 0 0 1-.5-7.97A5 5 0 0 1 16.2 8.02 4 4 0 0 1 17 16h-1"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v7m0-7 2.5 2.5M12 12l-2.5 2.5" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 shrink-0">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9Z"
      />
      <path strokeLinecap="round" strokeDasharray="2 2" d="M9 7v10" />
    </svg>
  );
}

function PillField({
  icon,
  value,
  onChange,
  type = "text",
  required = true,
  showError,
  placeholder,
}: {
  icon: ReactElement;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  showError?: boolean;
  placeholder: string;
}) {
  const invalid = showError && required && !value.trim();
  return (
    <label className="flex flex-col gap-1">
      <div
        className={`flex items-center gap-2 sm:gap-3 rounded-full border bg-white px-4 sm:px-5 py-3 sm:py-4 text-rust focus-within:border-rust ${
          invalid ? "border-red-500" : "border-rust/70"
        }`}
      >
        {icon}
        <input
          required={required}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-sm sm:text-lg text-emerald placeholder:text-emerald/70 focus:outline-none"
        />
      </div>
      {invalid && <span className="text-sm text-red-600 pl-5">Required</span>}
    </label>
  );
}

export function DetailsStep() {
  const dispatch = useAppDispatch();
  const registration = useAppSelector((s) => s.registration);
  const { category, fullName, email, phone, formData, studentIdFileName } = registration;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  async function handleStudentIdUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const { key, uploadUrl } = await requestStudentIdUploadUrl(file.name, file.type);
      await uploadStudentIdFile(uploadUrl, file);
      dispatch(setStudentIdFile({ key, fileName: file.name }));
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const canContinue =
    fullName.trim() && email.trim() && phone.trim() &&
    (category === "student"
      ? formData.institution && registration.studentIdFileKey
      : formData.role && formData.industry);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canContinue) {
      setAttemptedSubmit(true);
      return;
    }
    dispatch(setStep("review"));
  }

  const showStudentIdError = attemptedSubmit && category === "student" && !registration.studentIdFileKey;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="font-plex text-base lg:text-lg font-semibold uppercase tracking-[0.15em] text-forest text-center mb-4">
        {category && CATEGORY_LABELS[category]} Ticket
      </h2>

      <PillField
        icon={<PersonIcon />}
        value={fullName}
        onChange={(v) => dispatch(setContactField({ field: "fullName", value: v }))}
        showError={attemptedSubmit}
        placeholder="Full Name (As it should appear on the event badge)"
      />
      <PillField
        icon={<EnvelopeIcon />}
        type="email"
        value={email}
        onChange={(v) => dispatch(setContactField({ field: "email", value: v }))}
        showError={attemptedSubmit}
        placeholder="Email Address"
      />
      <PillField
        icon={<PhoneIcon />}
        type="tel"
        value={phone}
        onChange={(v) => dispatch(setContactField({ field: "phone", value: v }))}
        showError={attemptedSubmit}
        placeholder="Phone Number"
      />

      {category === "student" && (
        <>
          <PillField
            icon={<InstitutionIcon />}
            value={formData.institution ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "institution", value: v }))}
            showError={attemptedSubmit}
            placeholder="Institution Name"
          />

          <label className="flex flex-col gap-1 mt-2 mx-auto w-full max-w-md">
            <div
              className={`relative flex items-center justify-center gap-2 sm:gap-3 rounded-full border bg-white px-4 sm:px-6 py-3 sm:py-4 text-rust ${
                showStudentIdError ? "border-red-500" : "border-rust/70"
              }`}
            >
              <CloudUploadIcon />
              <span className="text-sm sm:text-lg text-emerald text-center truncate min-w-0">
                {studentIdFileName ?? "Student ID Card (Upload for Verification)"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleStudentIdUpload(file);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            {uploading && <span className="text-sm text-muted pl-5">Uploading…</span>}
            {uploadError && <span className="text-sm text-red-600 pl-5">{uploadError}</span>}
            {showStudentIdError && <span className="text-sm text-red-600 pl-5">Required</span>}
          </label>
        </>
      )}

      {(category === "regular" || category === "professional") && (
        <>
          <PillField
            icon={<InstitutionIcon />}
            required={false}
            value={formData.organization ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "organization", value: v }))}
            showError={attemptedSubmit}
            placeholder="Organization/Startup Name (Optional)"
          />
          <PillField
            icon={<BadgeIcon />}
            value={formData.role ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "role", value: v }))}
            showError={attemptedSubmit}
            placeholder="Job Title/Position"
          />
          <PillField
            icon={<IndustryIcon />}
            value={formData.industry ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "industry", value: v }))}
            showError={attemptedSubmit}
            placeholder="Industry/Sector"
          />
          <PillField
            icon={<LinkedInIcon />}
            type="url"
            required={false}
            value={formData.linkedin ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "linkedin", value: v }))}
            placeholder="LinkedIn Profile (Optional)"
          />
        </>
      )}

      <button
        type="submit"
        className="flex mx-auto w-full max-w-md items-center justify-center gap-2 sm:gap-3 bg-rust text-white font-semibold text-base sm:text-xl rounded-full py-4 sm:py-5 mt-4 hover:bg-rust/90 transition-colors"
      >
        <TicketIcon />
        Get Ticket
      </button>

    
    </form>
  );
}
