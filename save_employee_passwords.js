// Script to fetch all employees and save their emails with a default password
const fetch = require('node-fetch');
const fs = require('fs');

const EMPLOYEE_API = 'http://172.20.137.176:8080/api/employees';
const DEFAULT_PASSWORD = 'insa1234';
const OUTPUT_FILE = 'employee_passwords.csv';

async function saveEmployeePasswords() {
  try {
    const res = await fetch(EMPLOYEE_API);
    if (!res.ok) {
      throw new Error(`Failed to fetch employees: ${res.status}`);
    }
    const employees = await res.json();
    if (!Array.isArray(employees)) {
      throw new Error('API did not return an array');
    }
    const filtered = employees.filter(emp => emp.role && emp.role.toLowerCase() === 'employee');
    const lines = ['email,password'];
    filtered.forEach(emp => {
      if (emp.email) {
        lines.push(`${emp.email},${DEFAULT_PASSWORD}`);
      }
    });
    fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');
    console.log(`Saved ${filtered.length} employee emails with default password to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('Error:', err);
  }
}

saveEmployeePasswords();
