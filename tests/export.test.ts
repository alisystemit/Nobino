import test from "node:test";
import assert from "node:assert/strict";
import { buildExcel } from "../src/lib/export.ts";

test("buildExcel ساختار Workbook/Worksheet/Typed Cells را تولید می‌کند", () => {
  const xml = buildExcel([
    {
      name: "Users",
      columns: ["id", "phone"],
      rows: [["a1", "09120000000"], ["a2", null]],
    },
  ]);

  assert.match(xml, /<Workbook/);
  assert.match(xml, /<Worksheet ss:Name="Users">/);
  assert.match(xml, /<Data ss:Type="String">id<\/Data>/);
  assert.match(xml, /<Data ss:Type="String">09120000000<\/Data>/);
  assert.match(xml, /<Data ss:Type="String"><\/Data>/); // null سلولی خالی شد
});