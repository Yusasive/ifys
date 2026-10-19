// Hand-off from the Registrations page's "Email selected" bulk action to
// the Messages page: [registrationId, { fullName, email }][] in
// sessionStorage, read (and cleared) once when the Messages page mounts.
export const PRESELECTED_STORAGE_KEY = "admin:broadcast-preselected";
