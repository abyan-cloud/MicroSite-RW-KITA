import Database from "better-sqlite3";
import fs from "node:fs";

const db = new Database("./rw-kita.db");
db.exec(fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
export default db;
