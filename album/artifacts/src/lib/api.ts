// Helper to read the current user id from localStorage
export function getUserId(): string | null {
  const saved = localStorage.getItem("auth_user");
  if (!saved) return null;
  try {
    const user = JSON.parse(saved);
    return user?.id ? String(user.id) : null;
  } catch {
    return null;
  }
}
