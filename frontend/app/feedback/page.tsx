import { Metadata } from "next";
import { FeedbackFormPage } from "./feedback-form";

export const metadata: Metadata = {
  title: "Share Your Feedback",
};

export default function FeedbackPage() {
  return <FeedbackFormPage />;
}
