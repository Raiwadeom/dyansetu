const CITY_CODES = {
  udgir: "UDG",
  latur: "LTR",
  parbhani: "PRB",
  hingoli: "HGL",
  nanded: "NND"
};

function sanitizeName(name = "") {
  const slug = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 4);
  return slug || "USR";
}

function normalizeCity(city = "") {
  return String(city || "").trim().toLowerCase();
}

export function generateTrackingId({ name = "", city = "", role = "student", existingUsers = [] }) {
  const normalizedRole = String(role || "student").trim().toLowerCase();
  const rolePrefix = normalizedRole === "faculty" ? "FAC" : normalizedRole === "admin" ? "ADM" : "STU";
  const code = CITY_CODES[normalizeCity(city)] || "GEN";
  const namePart = sanitizeName(name);
  const sameCityRoleCount = existingUsers.filter((user) => {
    const userRole = String(user?.role || "student").trim().toLowerCase();
    return userRole === normalizedRole && normalizeCity(user?.city || "") === normalizeCity(city);
  }).length;
  const sequence = String(sameCityRoleCount + 1).padStart(3, "0");
  return `${code}-${rolePrefix}-${namePart}-${sequence}`;
}
