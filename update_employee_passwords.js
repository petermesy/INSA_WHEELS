// Script to update all employee passwords in the database to a default value
const fetch = require('node-fetch');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const EMPLOYEE_API = 'http://172.20.137.176:8080/api/employees';
const DEFAULT_PASSWORD = 'insa1234';
const SALT_ROUNDS = 10;

// Update these with your actual DB credentials or load from .env
const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'insa_wheels_tracker',
  password: 'admin',
  port: 5432,
};

async function updateEmployeePasswords() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const res = await fetch(EMPLOYEE_API);
    if (!res.ok) {
      throw new Error(`Failed to fetch employees: ${res.status}`);
    }
    const employees = await res.json();
    if (!Array.isArray(employees)) {
      throw new Error('API did not return an array');
    }
    const filtered = employees.filter(emp => emp.role && emp.role.toLowerCase() === 'employee');
    let updated = 0, inserted = 0;
    for (const emp of filtered) {
      if (emp.email) {
        const hashed = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
        // Try to update first
        const result = await client.query(
          'UPDATE users SET password = $1 WHERE email = $2 AND LOWER(role) = $3',
          [hashed, emp.email, 'employee']
        );
        if (result.rowCount > 0) {
          updated++;
        } else {
          // Insert if not found
          const name = emp.name || emp.email.split('@')[0];
          const phone = emp.phone || null;
          try {
            await client.query(
              'INSERT INTO users (name, email, password, role, phone) VALUES ($1, $2, $3, $4, $5)',
              [name, emp.email, hashed, 'employee', phone]
            );
            inserted++;
          } catch (insertErr) {
            console.error(`Failed to insert user ${emp.email}:`, insertErr.message);
          }
        }
      }
    }
    console.log(`Updated password for ${updated} employees. Inserted ${inserted} new employees.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

updateEmployeePasswords();
