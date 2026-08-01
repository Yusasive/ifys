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

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-ink-2 border border-line rounded-sm px-3 py-2 text-paper focus:outline-none focus:border-gold"
      />
    </label>
  );
}

export function DetailsStep() {
  const dispatch = useAppDispatch();
  const registration = useAppSelector((s) => s.registration);
  const { category, fullName, email, phone, formData, studentIdFileName } = registration;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleStudentIdUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const { key, uploadUrl } = await requestStudentIdUploadUrl(file.name, file.type);
      await uploadStudentIdFile(uploadUrl, file);
      dispatch(setStudentIdFile({ key, fileName: file.name }));
    } catch {
      setUploadError("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    dispatch(setStep("review"));
  }

  const canContinue =
    fullName.trim() && email.trim() && phone.trim() &&
    (category === "student"
      ? formData.institution && formData.courseOfStudy && formData.levelOrYear && registration.studentIdFileKey
      : formData[category === "founder" ? "startupName" : "organization"] &&
        formData.role &&
        formData.industry);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Full name" value={fullName} onChange={(v) => dispatch(setContactField({ field: "fullName", value: v }))} />
      <TextField label="Email" type="email" value={email} onChange={(v) => dispatch(setContactField({ field: "email", value: v }))} />
      <TextField label="Phone" type="tel" value={phone} onChange={(v) => dispatch(setContactField({ field: "phone", value: v }))} />

      {category === "student" && (
        <>
          <TextField
            label="Institution"
            value={formData.institution ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "institution", value: v }))}
          />
          <TextField
            label="Course of study"
            value={formData.courseOfStudy ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "courseOfStudy", value: v }))}
          />
          <TextField
            label="Level / year"
            value={formData.levelOrYear ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "levelOrYear", value: v }))}
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Student ID (image or PDF)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleStudentIdUpload(file);
              }}
              className="text-sm text-paper file:mr-3 file:rounded-sm file:border file:border-line file:bg-ink-2 file:px-3 file:py-1.5 file:text-paper"
            />
            {uploading && <span className="text-xs text-muted">Uploading…</span>}
            {studentIdFileName && !uploading && (
              <span className="text-xs text-gold-light">Uploaded: {studentIdFileName}</span>
            )}
            {uploadError && <span className="text-xs text-red-400">{uploadError}</span>}
          </label>
        </>
      )}

      {(category === "founder" || category === "professional") && (
        <>
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
          />
          <TextField
            label="Role"
            value={formData.role ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "role", value: v }))}
          />
          <TextField
            label="Industry"
            value={formData.industry ?? ""}
            onChange={(v) => dispatch(setFormField({ field: "industry", value: v }))}
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">LinkedIn (optional)</span>
            <input
              type="url"
              value={formData.linkedin ?? ""}
              onChange={(e) => dispatch(setFormField({ field: "linkedin", value: e.target.value }))}
              className="bg-ink-2 border border-line rounded-sm px-3 py-2 text-paper focus:outline-none focus:border-gold"
            />
          </label>
        </>
      )}

      <div className="flex justify-between mt-4">
        <button
          type="button"
          onClick={() => dispatch(setStep("tier"))}
          className="text-muted text-sm hover:text-paper"
        >
          ← Back
        </button>
        <button
          type="submit"
          disabled={!canContinue}
          className="bg-gold text-ink font-medium px-6 py-2 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Review
        </button>
      </div>
    </form>
  );
}
