const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

// Estructura inicial de la base de datos JSON
const initialData = {
  test_groups: [],
  test_cases: [],
  test_runs: [],
  test_execution_results: [],
  bugs: [],
  auto_ids: {
    test_groups: 1,
    test_cases: 1,
    test_runs: 1,
    test_execution_results: 1,
    bugs: 1
  }
};

function readData() {
  if (!fs.existsSync(dbPath)) {
    saveData(initialData);
    return initialData;
  }
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const data = JSON.parse(raw);

    let modified = false;
    if (!data.test_groups) {
      data.test_groups = [];
      if (!data.auto_ids) data.auto_ids = {};
      data.auto_ids.test_groups = 1;
      modified = true;
    }

    if (!data.bugs) {
      data.bugs = [];
      if (!data.auto_ids) data.auto_ids = {};
      data.auto_ids.bugs = 1;
      modified = true;
    } else {
      data.bugs.forEach(b => {
        if (b.reproduction === undefined) {
          b.reproduction = '';
          modified = true;
        }
        if (b.expected_result === undefined) {
          b.expected_result = '';
          modified = true;
        }
      });
    }

    // Migrar resultados antiguos para soportar array de evidencia y consolidar capturas previas
    if (data.test_execution_results && Array.isArray(data.test_execution_results)) {
      data.test_execution_results.forEach(r => {
        if (!Array.isArray(r.evidence_paths)) {
          r.evidence_paths = [];
          modified = true;
        }
        if (r.evidence_path && !r.evidence_paths.includes(r.evidence_path.replace(/\\/g, '/'))) {
          r.evidence_paths.push(r.evidence_path.replace(/\\/g, '/'));
          modified = true;
        }
        if (r.step_data && typeof r.step_data === 'object') {
          Object.values(r.step_data).forEach(s => {
            if (s && s.evidence_path) {
              const normPath = s.evidence_path.replace(/\\/g, '/');
              if (!r.evidence_paths.includes(normPath)) {
                r.evidence_paths.push(normPath);
                modified = true;
              }
            }
          });
        }
      });
    }

    if (data.test_cases && data.test_cases.length > 0) {
      if (data.test_groups.length === 0) {
        data.test_groups.push({
          id: 1,
          name: 'Grupo Importado Inicial',
          created_at: data.test_cases[0].created_at || new Date().toISOString()
        });
        data.auto_ids.test_groups = 2;
        modified = true;
      }
      data.test_cases.forEach(tc => {
        if (!tc.group_id) {
          tc.group_id = 1;
          modified = true;
        }
      });
    }

    if (modified) {
      saveData(data);
    }
    return data;
  } catch (e) {
    saveData(initialData);
    return initialData;
  }
}

function saveData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Adaptador compatible con los llamados de server.js
const db = {
  prepare: (sql) => {
    const sqlLower = sql.trim().toLowerCase();

    return {
      run: (...args) => {
        const data = readData();

        if (sqlLower.includes('insert into test_groups')) {
          const [name] = args;
          const id = data.auto_ids.test_groups++;
          const newItem = {
            id,
            name: name || `Grupo ${id}`,
            created_at: new Date().toISOString()
          };
          data.test_groups.push(newItem);
          saveData(data);
          return { lastInsertRowid: id };
        }

        if (sqlLower.includes('insert into test_cases')) {
          let group_id, case_number, title, summary, gherkin_steps, priority;
          if (args.length === 6) {
            [group_id, case_number, title, summary, gherkin_steps, priority] = args;
          } else {
            [case_number, title, summary, gherkin_steps, priority] = args;
            group_id = 1;
          }
          const id = data.auto_ids.test_cases++;
          const newItem = {
            id,
            group_id: Number(group_id) || 1,
            case_number,
            title,
            summary,
            gherkin_steps,
            priority: priority || 'Media',
            created_at: new Date().toISOString()
          };
          data.test_cases.push(newItem);
          saveData(data);
          return { lastInsertRowid: id };
        }

        if (sqlLower.includes('insert into test_runs')) {
          const [name, environment, group_id] = args;
          const id = data.auto_ids.test_runs++;
          const newItem = {
            id,
            name,
            environment: environment || 'QA',
            group_id: group_id ? (group_id === 'all' ? 'all' : Number(group_id)) : 'all',
            status: 'In Progress',
            created_at: new Date().toISOString()
          };
          data.test_runs.push(newItem);
          saveData(data);
          return { lastInsertRowid: id };
        }

        if (sqlLower.includes('insert into test_execution_results')) {
          const [run_id, case_id] = args;
          const id = data.auto_ids.test_execution_results++;
          const newItem = {
            id,
            run_id: Number(run_id),
            case_id: Number(case_id),
            status: 'Untested',
            notes: '',
            step_data: {},
            evidence_paths: [],
            executed_at: null
          };
          data.test_execution_results.push(newItem);
          saveData(data);
          return { lastInsertRowid: id };
        }

        if (sqlLower.includes('insert into bugs')) {
          const [run_id, case_id, result_id, title, description, reproduction, expected_result, assigned_to, severity, status, evidence_paths] = args;
          const id = data.auto_ids.bugs++;
          const newItem = {
            id,
            run_id: run_id ? Number(run_id) : null,
            case_id: case_id ? Number(case_id) : null,
            result_id: result_id ? Number(result_id) : null,
            title: title || 'Sin Título',
            description: description || '',
            reproduction: reproduction || '',
            expected_result: expected_result || '',
            assigned_to: assigned_to || 'Sin Asignar',
            severity: severity || 'Media',
            status: status || 'Abierto',
            evidence_paths: evidence_paths ? JSON.parse(evidence_paths) : [],
            created_at: new Date().toISOString()
          };
          data.bugs.push(newItem);
          saveData(data);
          return { lastInsertRowid: id };
        }

        if (sqlLower.includes('update bugs')) {
          const [run_id, case_id, result_id, title, description, reproduction, expected_result, assigned_to, severity, status, evidence_paths, id] = args;
          const target = data.bugs.find(b => String(b.id) === String(id));
          if (target) {
            if (run_id !== undefined) target.run_id = run_id ? Number(run_id) : null;
            if (case_id !== undefined) target.case_id = case_id ? Number(case_id) : null;
            if (result_id !== undefined) target.result_id = result_id ? Number(result_id) : null;
            if (title !== undefined) target.title = title;
            if (description !== undefined) target.description = description;
            if (reproduction !== undefined) target.reproduction = reproduction;
            if (expected_result !== undefined) target.expected_result = expected_result;
            if (assigned_to !== undefined) target.assigned_to = assigned_to;
            if (severity !== undefined) target.severity = severity;
            if (status !== undefined) target.status = status;
            if (evidence_paths !== undefined) target.evidence_paths = evidence_paths ? JSON.parse(evidence_paths) : [];
            saveData(data);
          }
          return { changes: target ? 1 : 0 };
        }

        if (sqlLower.includes('update test_runs')) {
          const [name, environment, id] = args;
          const target = data.test_runs.find(tr => String(tr.id) === String(id));
          if (target) {
            if (name !== undefined) target.name = name;
            if (environment !== undefined) target.environment = environment;
            saveData(data);
          }
          return { changes: target ? 1 : 0 };
        }

        if (sqlLower.includes('delete from bugs')) {
          const [id] = args;
          const initialLen = data.bugs.length;
          data.bugs = data.bugs.filter(b => String(b.id) !== String(id));
          const removed = initialLen - data.bugs.length;
          saveData(data);
          return { changes: removed };
        }

        if (sqlLower.includes('update test_execution_results')) {
          let target = null;

          if (args.length === 2) {
            const [evidence_paths, resultId] = args;
            target = data.test_execution_results.find(r => String(r.id) === String(resultId));
            if (target) {
              if (Array.isArray(evidence_paths)) {
                target.evidence_paths = evidence_paths;
              } else if (typeof evidence_paths === 'string') {
                try {
                  target.evidence_paths = JSON.parse(evidence_paths);
                } catch(e) {
                  target.evidence_paths = evidence_paths ? [evidence_paths] : [];
                }
              }
              target.executed_at = new Date().toISOString();
              saveData(data);
            }
          } else {
            let status, notes, evidence_paths, step_data, resultId;
            if (args.length >= 5) {
              [status, notes, evidence_paths, step_data, resultId] = args;
            } else {
              [status, notes, evidence_paths, resultId] = args;
            }
            target = data.test_execution_results.find(r => String(r.id) === String(resultId));
            if (target) {
              if (status !== undefined) target.status = status;
              if (notes !== undefined) target.notes = notes;
              if (evidence_paths !== undefined) {
                if (Array.isArray(evidence_paths)) {
                  target.evidence_paths = evidence_paths;
                } else if (typeof evidence_paths === 'string') {
                  try {
                    target.evidence_paths = JSON.parse(evidence_paths);
                  } catch(e) {
                    target.evidence_paths = evidence_paths ? [evidence_paths] : [];
                  }
                }
              }
              if (step_data !== undefined) {
                try {
                  target.step_data = typeof step_data === 'string' ? JSON.parse(step_data) : step_data;
                } catch (e) {
                  target.step_data = step_data;
                }
              }
              target.executed_at = new Date().toISOString();
              saveData(data);
            }
          }
          return { changes: target ? 1 : 0 };
        }

        if (sqlLower.includes('delete from test_runs')) {
          const [runId] = args;
          const initialCount = data.test_runs.length;
          data.test_runs = data.test_runs.filter(r => String(r.id) !== String(runId));
          data.test_execution_results = data.test_execution_results.filter(r => String(r.run_id) !== String(runId));
          data.bugs = data.bugs.filter(b => String(b.run_id) !== String(runId));
          const removed = initialCount - data.test_runs.length;
          saveData(data);
          return { changes: removed };
        }

        if (sqlLower.includes('delete from test_groups')) {
          const [groupId] = args;
          const initialCount = data.test_groups.length;
          data.test_groups = data.test_groups.filter(g => String(g.id) !== String(groupId));

          // Identificar casos pertenecientes al grupo a eliminar
          const deletedCaseIds = new Set(
            data.test_cases
              .filter(tc => String(tc.group_id) === String(groupId))
              .map(tc => tc.id)
          );

          // Eliminar casos de prueba del grupo
          data.test_cases = data.test_cases.filter(tc => String(tc.group_id) !== String(groupId));

          // Eliminar resultados de ejecución y bugs asociados a esos casos
          data.test_execution_results = data.test_execution_results.filter(r => !deletedCaseIds.has(Number(r.case_id)));
          data.bugs = data.bugs.filter(b => !deletedCaseIds.has(Number(b.case_id)));

          const removed = initialCount - data.test_groups.length;
          saveData(data);
          return { changes: removed };
        }

        return { lastInsertRowid: 0, changes: 0 };
      },

      all: (...args) => {
        const data = readData();

        if (sqlLower.includes('from bugs')) {
          let results = data.bugs.map(b => {
            const tc = b.case_id ? (data.test_cases.find(c => Number(c.id) === Number(b.case_id)) || {}) : {};
            const tr = b.run_id ? (data.test_runs.find(r => Number(r.id) === Number(b.run_id)) || {}) : {};
            const ter = (b.result_id || (b.case_id && b.run_id)) ? data.test_execution_results.find(r => (b.result_id && Number(r.id) === Number(b.result_id)) || (b.case_id && b.run_id && Number(r.case_id) === Number(b.case_id) && Number(r.run_id) === Number(b.run_id))) : null;
            const terEvidence = ter ? (Array.isArray(ter.evidence_paths) ? ter.evidence_paths : (ter.evidence_path ? [ter.evidence_path] : [])) : [];
            const bugNativeEvidence = Array.isArray(b.evidence_paths) ? b.evidence_paths : [];
            const combinedEvidence = Array.from(new Set([...bugNativeEvidence, ...terEvidence]));
            
            let group_id = tc.group_id || (tr.group_id && tr.group_id !== 'all' ? tr.group_id : null);
            let groupObj = group_id ? data.test_groups.find(g => Number(g.id) === Number(group_id)) : null;
            let group_name = groupObj ? groupObj.name : (group_id ? `Grupo ${group_id}` : 'General / Sin Grupo');

            return {
              ...b,
              reproduction: b.reproduction || '',
              expected_result: b.expected_result || '',
              group_id: group_id ? Number(group_id) : null,
              group_name,
              case_number: b.case_id ? (tc.case_number ? `TC-${tc.case_number}` : `TC-${b.case_id}`) : 'General de la Ejecución',
              case_title: tc.title || '',
              run_name: tr.name || 'Sin Ejecución Asignada',
              evidence_paths: combinedEvidence
            };
          });

          return results.reverse();
        }

        if (sqlLower.includes('from test_groups')) {
          return data.test_groups.map(g => {
            const groupCases = data.test_cases.filter(c => Number(c.group_id) === Number(g.id));
            return {
              ...g,
              total_cases: groupCases.length
            };
          }).reverse();
        }

        if (sqlLower.includes('from test_cases')) {
          let result = [...data.test_cases].map(tc => {
            const grp = data.test_groups.find(g => Number(g.id) === Number(tc.group_id));
            return {
              ...tc,
              group_name: grp ? grp.name : 'Sin Grupo'
            };
          });

          if (sqlLower.includes('where group_id =') && args.length > 0 && args[0] && args[0] !== 'all') {
            const filterGroupId = Number(args[0]);
            result = result.filter(tc => Number(tc.group_id) === filterGroupId);
          }

          return result.reverse();
        }

        if (sqlLower.includes('from test_runs')) {
          return data.test_runs.map(run => {
            const results = data.test_execution_results.filter(r => Number(r.run_id) === Number(run.id));
            const total_cases = results.length;
            const passed_cases = results.filter(r => r.status === 'Pass').length;
            const failed_cases = results.filter(r => r.status === 'Fail').length;
            const blocked_cases = results.filter(r => r.status === 'Blocked').length;
            const desestimado_cases = results.filter(r => r.status === 'Desestimado').length;
            const groupObj = data.test_groups.find(g => Number(g.id) === Number(run.group_id));
            return {
              ...run,
              group_name: groupObj ? groupObj.name : (run.group_id === 'all' ? 'Todos los grupos' : 'Sin Grupo'),
              total_cases,
              passed_cases,
              failed_cases,
              blocked_cases,
              desestimado_cases
            };
          }).reverse();
        }

        if (sqlLower.includes('from test_execution_results')) {
          const runId = args[0];
          const results = data.test_execution_results.filter(r => Number(r.run_id) === Number(runId));
          return results.map(r => {
            const tc = data.test_cases.find(c => Number(c.id) === Number(r.case_id)) || {};
            const grp = data.test_groups.find(g => Number(g.id) === Number(tc.group_id));
            const resEvidences = Array.isArray(r.evidence_paths) ? r.evidence_paths : (r.evidence_path ? [r.evidence_path] : []);
            const caseBugs = data.bugs
              .filter(b => Number(b.result_id) === Number(r.id) || (Number(b.case_id) === Number(r.case_id) && Number(b.run_id) === Number(r.run_id)))
              .map(b => ({ ...b, evidence_paths: Array.from(new Set([...(Array.isArray(b.evidence_paths) ? b.evidence_paths : []), ...resEvidences])) }));
            return {
              result_id: r.id,
              run_id: Number(r.run_id),
              status: r.status,
              notes: r.notes,
              step_data: r.step_data || {},
              evidence_paths: resEvidences,
              executed_at: r.executed_at,
              case_id: tc.id,
              group_id: tc.group_id,
              group_name: grp ? grp.name : '',
              case_number: tc.case_number || `TC-${r.case_id}`,
              title: tc.title || 'Caso',
              summary: tc.summary || '',
              gherkin_steps: tc.gherkin_steps || '',
              priority: tc.priority || 'Media',
              created_at: tc.created_at,
              bugs: caseBugs
            };
          });
        }

        return [];
      },

      get: (...args) => {
        const data = readData();
        if (sqlLower.includes('from bugs where id =')) {
          const id = args[0];
          return data.bugs.find(b => String(b.id) === String(id)) || null;
        }
        if (sqlLower.includes('from test_groups where id =')) {
          const id = args[0];
          return data.test_groups.find(g => String(g.id) === String(id)) || null;
        }
        if (sqlLower.includes('from test_runs where id =')) {
          const id = args[0];
          const run = data.test_runs.find(r => String(r.id) === String(id));
          if (!run) return null;
          const groupObj = data.test_groups.find(g => Number(g.id) === Number(run.group_id));
          return {
            ...run,
            group_name: groupObj ? groupObj.name : (run.group_id === 'all' ? 'Todos los grupos' : 'Sin Grupo')
          };
        }
        if (sqlLower.includes('from test_execution_results where id =')) {
          const id = args[0];
          return data.test_execution_results.find(r => String(r.id) === String(id)) || null;
        }
        return null;
      }
    };
  },

  transaction: (fn) => {
    return (...args) => fn(...args);
  }
};

console.log('Base de datos JSON inicializada correctamente (Zero-dependency).');

module.exports = db;
