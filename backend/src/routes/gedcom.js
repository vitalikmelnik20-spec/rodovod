const router = require('express').Router();
const { query, getClient } = require('../config/db');
const { requireAuth, requireTreeRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── GEDCOM Export ─────────────────────────────────────────────────────────────
// GET /api/trees/:id/gedcom
router.get('/:id/gedcom', requireAuth, requireTreeRole(['admin', 'editor', 'viewer']), async (req, res) => {
  try {
    const { rows: persons } = await query(
      'SELECT * FROM persons WHERE tree_id = $1 ORDER BY last_name, first_name',
      [req.params.id]
    );
    const { rows: rels } = await query(
      'SELECT * FROM relationships WHERE tree_id = $1',
      [req.params.id]
    );
    const { rows: [tree] } = await query('SELECT name FROM trees WHERE id = $1', [req.params.id]);

    const lines = [];
    const idMap = {};
    persons.forEach((p, i) => { idMap[p.id] = `I${i + 1}`; });

    lines.push('0 HEAD');
    lines.push('1 GEDC');
    lines.push('2 VERS 5.5.1');
    lines.push('2 FORM LINEAGE-LINKED');
    lines.push('1 CHAR UTF-8');
    lines.push(`1 NOTE Exported from Родовід — ${tree?.name || 'Family Tree'}`);

    // Individuals
    persons.forEach(p => {
      const ref = idMap[p.id];
      lines.push(`0 @${ref}@ INDI`);

      const nameParts = [p.first_name, p.patronymic].filter(Boolean).join(' ');
      const surname = p.last_name || '';
      lines.push(`1 NAME ${nameParts} /${surname}/`);
      if (p.first_name) lines.push(`2 GIVN ${p.first_name}`);
      if (p.last_name)  lines.push(`2 SURN ${p.last_name}`);
      if (p.patronymic) lines.push(`2 _PATR ${p.patronymic}`);

      if (p.birth_date || p.birth_place) {
        lines.push('1 BIRT');
        if (p.birth_date) lines.push(`2 DATE ${formatGedcomDate(p.birth_date)}`);
        if (p.birth_place) lines.push(`2 PLAC ${p.birth_place}`);
      }

      if (p.death_date || (!p.is_alive && !p.birth_date)) {
        lines.push('1 DEAT');
        if (p.death_date) lines.push(`2 DATE ${formatGedcomDate(p.death_date)}`);
      }

      if (p.biography) {
        const note = p.biography.replace(/\n/g, '\n2 CONT ');
        lines.push(`1 NOTE ${note}`);
      }
    });

    // Families (spouse pairs)
    const families = new Map();
    rels.forEach(r => {
      if (r.relation_type === 'spouse') {
        const key = [r.person_a_id, r.person_b_id].sort().join('_');
        if (!families.has(key)) families.set(key, { husb: r.person_a_id, wife: r.person_b_id, children: [] });
      }
    });

    // Attach children
    rels.forEach(r => {
      if (r.relation_type === 'parent_child') {
        // person_a is parent, person_b is child
        const parentId = r.person_a_id;
        const childId = r.person_b_id;
        let attached = false;
        families.forEach((fam) => {
          if (fam.husb === parentId || fam.wife === parentId) {
            fam.children.push(childId);
            attached = true;
          }
        });
        if (!attached) {
          const key = `solo_${parentId}`;
          if (!families.has(key)) families.set(key, { husb: parentId, wife: null, children: [] });
          families.get(key).children.push(childId);
        }
      }
    });

    let famIdx = 1;
    families.forEach((fam) => {
      const ref = `F${famIdx++}`;
      lines.push(`0 @${ref}@ FAM`);
      if (fam.husb && idMap[fam.husb]) lines.push(`1 HUSB @${idMap[fam.husb]}@`);
      if (fam.wife && idMap[fam.wife]) lines.push(`1 WIFE @${idMap[fam.wife]}@`);
      fam.children.forEach(cid => {
        if (idMap[cid]) lines.push(`1 CHIL @${idMap[cid]}@`);
      });
    });

    lines.push('0 TRLR');

    const gedcom = lines.join('\r\n');
    const filename = `${(tree?.name || 'tree').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.ged`;

    res.setHeader('Content-Type', 'application/x-gedcom; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(gedcom);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export error' });
  }
});

function formatGedcomDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

// ── GEDCOM Import ─────────────────────────────────────────────────────────────
// POST /api/trees/:id/gedcom/import
router.post('/:id/gedcom/import', requireAuth, requireTreeRole(['admin']),
  upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });

    const text = req.file.buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const individuals = {};  // gedcomId → data
    let current = null;
    let currentTag = null;

    lines.forEach(line => {
      const match = line.match(/^(\d+)\s+(@[^@]+@)?\s*([A-Z_]+)\s*(.*)?$/);
      if (!match) return;
      const [, level, xref, tag, value] = match;
      const lvl = parseInt(level);

      if (lvl === 0 && xref && tag === 'INDI') {
        current = { _xref: xref, first_name: null, last_name: null, patronymic: null, birth_date: null, birth_place: null, death_date: null, is_alive: true, biography: null };
        individuals[xref] = current;
        currentTag = null;
      } else if (lvl === 0) {
        current = null; currentTag = null;
      } else if (current) {
        if (lvl === 1) {
          currentTag = tag;
          if (tag === 'NAME' && value) {
            const m = value.match(/^(.*?)\s*\/([^/]*)\//);
            if (m) {
              current.first_name = m[1].trim().split(' ')[0] || null;
              current.last_name = m[2].trim() || null;
            } else {
              const parts = value.split(' ');
              current.first_name = parts[0] || null;
              current.last_name = parts.slice(1).join(' ') || null;
            }
          }
          if (tag === 'DEAT') current.is_alive = false;
          if (tag === 'NOTE' && value) current.biography = value;
        } else if (lvl === 2) {
          if (currentTag === 'BIRT') {
            if (tag === 'DATE') current.birth_date = parseGedcomDate(value);
            if (tag === 'PLAC') current.birth_place = value;
          }
          if (currentTag === 'DEAT') {
            if (tag === 'DATE') current.death_date = parseGedcomDate(value);
          }
          if (tag === 'GIVN') current.first_name = value || current.first_name;
          if (tag === 'SURN') current.last_name = value || current.last_name;
          if (tag === '_PATR') current.patronymic = value || null;
          if (tag === 'CONT' && current.biography !== null) current.biography += '\n' + value;
        }
      }
    });

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const xrefToDbId = {};
      let imported = 0;

      for (const [xref, indi] of Object.entries(individuals)) {
        if (!indi.first_name && !indi.last_name) continue;
        const personId = uuidv4();
        xrefToDbId[xref] = personId;
        await client.query(
          `INSERT INTO persons (id, tree_id, first_name, last_name, patronymic, birth_date,
            death_date, birth_place, is_alive, biography, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT DO NOTHING`,
          [personId, req.params.id, indi.first_name, indi.last_name, indi.patronymic,
           indi.birth_date, indi.death_date, indi.birth_place,
           indi.is_alive, indi.biography, req.user.telegram_id]
        );
        imported++;
      }

      // Import family relationships
      let famCurrent = null;
      lines.forEach(line => {
        const match = line.match(/^(\d+)\s+(@[^@]+@)?\s*([A-Z_]+)\s*(.*)?$/);
        if (!match) return;
        const [, level, xref, tag, value] = match;
        const lvl = parseInt(level);

        if (lvl === 0 && xref && tag === 'FAM') {
          famCurrent = { husb: null, wife: null, children: [] };
        } else if (lvl === 0) {
          if (famCurrent) processFam(famCurrent, xrefToDbId, client, req.params.id, req.user.telegram_id);
          famCurrent = null;
        } else if (famCurrent) {
          const ref = value?.match(/@([^@]+)@/)?.[0];
          if (tag === 'HUSB' && ref) famCurrent.husb = ref;
          if (tag === 'WIFE' && ref) famCurrent.wife = ref;
          if (tag === 'CHIL' && ref) famCurrent.children.push(ref);
        }
      });
      if (famCurrent) processFam(famCurrent, xrefToDbId, client, req.params.id, req.user.telegram_id);

      await client.query('COMMIT');
      res.json({ ok: true, imported });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Import error' });
    } finally {
      client.release();
    }
  }
);

async function processFam(fam, xrefToDbId, client, treeId, createdBy) {
  const hId = fam.husb && xrefToDbId[fam.husb];
  const wId = fam.wife && xrefToDbId[fam.wife];
  if (hId && wId) {
    await client.query(
      `INSERT INTO relationships (id, tree_id, person_a_id, person_b_id, relation_type, created_by)
       VALUES ($1,$2,$3,$4,'spouse',$5) ON CONFLICT DO NOTHING`,
      [uuidv4(), treeId, hId, wId, createdBy]
    ).catch(() => {});
  }
  const parentId = hId || wId;
  if (parentId) {
    for (const cRef of fam.children) {
      const cId = xrefToDbId[cRef];
      if (cId) {
        await client.query(
          `INSERT INTO relationships (id, tree_id, person_a_id, person_b_id, relation_type, created_by)
           VALUES ($1,$2,$3,$4,'parent_child',$5) ON CONFLICT DO NOTHING`,
          [uuidv4(), treeId, parentId, cId, createdBy]
        ).catch(() => {});
      }
    }
  }
}

function parseGedcomDate(str) {
  if (!str) return null;
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const m = str.match(/(\d{1,2})?\s*([A-Z]{3})?\s*(\d{4})/);
  if (!m) return null;
  const year = parseInt(m[3]);
  const month = m[2] ? months[m[2]] ?? 0 : 0;
  const day = m[1] ? parseInt(m[1]) : 1;
  return new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];
}

module.exports = router;
