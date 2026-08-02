"use client";

import { FormEvent, useState } from "react";
import { requestStudentIdUploadUrl, uploadStudentIdFile } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  setContactField,
  setFormField,
  setStep,
  setStudentIdFile,
} from "@/lib/registration-slice";
import { BackButton } from "./back-button";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-emerald/60 mt-2 mb-1">
      {children}
    </h2>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  showError,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  showError?: boolean;
  placeholder?: string;
}) {
  const invalid = showError && required && !value.trim();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-base font-medium text-emerald/75">
        {label}
        {!required && <span className="text-muted font-normal"> (optional)</span>}
      </span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-cloud border rounded-sm px-3 py-3 text-base text-emerald placeholder:text-muted/60 focus:outline-none focus:border-gold ${
          invalid ? "border-red-500" : "border-line"
        }`}
      />
      {invalid && <span className="text-sm text-red-600">Required</span>}
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
      ? formData.institution && formData.courseOfStudy && formData.levelOrYear && registration.studentIdFileKey
      : formData[category === "founder" ? "startupName" : "organization"] &&
        formData.role &&
        formData.industry);

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
      <SectionHeading>Contact information</SectionHeading>
      <TextField
        label="Full name"
        value={fullName}
        onChange={(v) => dispatch(setContactField({ field: "fullName", value: v }))}
        showError={attemptedSubmit}
        placeholder="e.g. Yusuf Abdullahi"
      />
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(v) => dispatch(setContactField({ field: "email", value: v }))}
        showError={attemptedSubmit}
        placeholder="you@example.com"
      />
      <TextField
        label="Phone"
        type="tel"
        value={phone}
        onChange={(v) => dispatch(setContactField({ field: "phone", value: v }))}
        showError={attemptedSubmit}
        placeholder="080X XXX XXXX"
      />

      {category === "student" && (
        <>
          <SectionHeading>Student details</SectionHeading>
          <TextField
            label="Institution"
            value={formData.institution ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "institution", value: v }))}
            showError={attemptedSubmit}
            placeholder="e.g. University of Ilorin"
          />
          <TextField
            label="Course of study"
            value={formData.courseOfStudy ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "courseOfStudy", value: v }))}
            showError={attemptedSubmit}
            placeholder="e.g. Economics"
          />
          <TextField
            label="Level / year"
            value={formData.levelOrYear ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "levelOrYear", value: v }))}
            showError={attemptedSubmit}
            placeholder="e.g. 300 level"
          />
          <label className="flex flex-col gap-1">
            <span className="text-base font-medium text-emerald/75">Student ID (image or PDF)</span>
            <div
              className={`border border-dashed rounded-sm px-4 py-4 flex items-center gap-3 ${
                showStudentIdError ? "border-red-500" : "border-line"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-6 h-6 shrink-0 text-muted"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16V4m0 0-4 4m4-4 4 4M5 16v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
                />
              </svg>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleStudentIdUpload(file);
                  }}
                  className="text-base text-emerald file:mr-3 file:rounded-sm file:border file:border-line file:bg-cloud file:px-3 file:py-1.5 file:text-emerald"
                />
                {uploading && <span className="text-sm text-muted block mt-1">Uploading…</span>}
                {studentIdFileName && !uploading && (
                  <span className="text-sm text-gold-deep block mt-1">Uploaded: {studentIdFileName}</span>
                )}
                {uploadError && <span className="text-sm text-red-600 block mt-1">{uploadError}</span>}
              </div>
            </div>
            {showStudentIdError && <span className="text-sm text-red-600">Required</span>}
          </label>
        </>
      )}

      {(category === "founder" || category === "professional") && (
        <>
          <SectionHeading>{category === "founder" ? "Founder details" : "Professional details"}</SectionHeading>
          <TextField
            label={category === "founder" ? "Startup / company name" : "Organization"}
            value={formData[category === "founder" ? "startupName" : "organization"] ?? ""}
            onChange={(v) =>
              dispatch(
                setFormField({
                  field: category === "founder" ? "startupName" : "organization",
                  value: v,
                }),
              )
            }
            showError={attemptedSubmit}
            placeholder={category === "founder" ? "e.g. Acme Fintech" : "e.g. Acme Bank"}
          />
          <TextField
            label="Role"
            value={formData.role ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "role", value: v }))}
            showError={attemptedSubmit}
            placeholder={category === "founder" ? "e.g. Co-founder & CEO" : "e.g. Product Manager"}
          />
          <TextField
            label="Industry"
            value={formData.industry ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "industry", value: v }))}
            showError={attemptedSubmit}
            placeholder="e.g. Fintech"
          />
          <TextField
            label="LinkedIn"
            type="url"
            required={false}
            value={formData.linkedin ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "linkedin", value: v }))}
            placeholder="linkedin.com/in/username"
          />
        </>
      )}

      <div className="flex justify-between items-center mt-4">
        <BackButton onClick={() => dispatch(setStep("category"))} />
        <button
          type="submit"
          className="bg-gold text-ink font-semibold text-lg px-6 py-2 rounded-sm"
        >
          Review
        </button>
      </div>
    </form>
  );
}
