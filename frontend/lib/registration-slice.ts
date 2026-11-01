import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Category, Tier } from "./api";

export type WizardStep = "category" | "details" | "review";

interface RegistrationState {
  step: WizardStep;
  category: Category | null;
  tier: Tier | null;
  fullName: string;
  email: string;
  phone: string;
  formData: Record<string, string>;
  studentIdFileKey: string | null;
  studentIdFileName: string | null;
  // Field-level problems the server reported on submit, keyed by field name.
  serverErrors: Record<string, string>;
}

const initialState: RegistrationState = {
  step: "category",
  category: null,
  tier: null,
  fullName: "",
  email: "",
  phone: "",
  formData: {},
  studentIdFileKey: null,
  studentIdFileName: null,
  serverErrors: {},
};

const registrationSlice = createSlice({
  name: "registration",
  initialState,
  reducers: {
    setStep(state, action: PayloadAction<WizardStep>) {
      state.step = action.payload;
    },
    setCategory(state, action: PayloadAction<Category>) {
      state.category = action.payload;
      state.tier = null;
      state.formData = {};
      state.studentIdFileKey = null;
      state.studentIdFileName = null;
    },
    setTier(state, action: PayloadAction<Tier>) {
      state.tier = action.payload;
    },
    setContactField(
      state,
      action: PayloadAction<{ field: "fullName" | "email" | "phone"; value: string }>,
    ) {
      state[action.payload.field] = action.payload.value;
      delete state.serverErrors[action.payload.field];
    },
    setFormField(state, action: PayloadAction<{ field: string; value: string }>) {
      state.formData[action.payload.field] = action.payload.value;
      delete state.serverErrors[action.payload.field];
    },
    setServerErrors(state, action: PayloadAction<Record<string, string>>) {
      state.serverErrors = action.payload;
    },
    setStudentIdFile(
      state,
      action: PayloadAction<{ key: string; fileName: string }>,
    ) {
      state.studentIdFileKey = action.payload.key;
      state.studentIdFileName = action.payload.fileName;
      delete state.serverErrors.studentIdFileKey;
    },
    reset() {
      return initialState;
    },
  },
});

export const {
  setStep,
  setCategory,
  setTier,
  setContactField,
  setFormField,
  setServerErrors,
  setStudentIdFile,
  reset,
} = registrationSlice.actions;

export default registrationSlice.reducer;
