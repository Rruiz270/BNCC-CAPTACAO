import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const fks = await sql`
  SELECT
    tc.table_schema, tc.table_name, kcu.column_name,
    ccu.table_schema AS ref_schema, ccu.table_name AS ref_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_schema = 'fundeb'
    AND ccu.table_name = 'consultorias'
  ORDER BY tc.table_schema, tc.table_name`;
console.log(JSON.stringify(fks, null, 2));
