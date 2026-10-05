import type { OkPacket, Pool } from "mysql2/promise"

import type { RiderApplicationInput } from "./rider-applications.dto"

export async function insertRiderApplication(
  db: Pool,
  input: RiderApplicationInput,
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO rider_applications
      (name, phone, email, district, vehicle_type, license_number, experience_years, availability, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.phone,
      input.email || null,
      input.district,
      input.vehicleType,
      input.licenseNumber || null,
      input.experienceYears ?? null,
      input.availability,
      input.notes || null,
    ],
  )
  if (!result.insertId) throw new Error("Rider application insert returned no id")
  return String(result.insertId)
}
