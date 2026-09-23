from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    p.write_text(text.replace(old, new, 1))


service = Path('src/services/modelReadiness.service.ts')
text = service.read_text()
if 'ensureModelShadowComparisonFreshBestEffort' not in text:
    text += '''\n\nconst modelShadowComparisonInFlight = new Set<string>();\n\nexport function ensureModelShadowComparisonFreshBestEffort(\n  fieldId: string,\n) {\n  const field = normalizedId(fieldId);\n  if (!field || modelShadowComparisonInFlight.has(field)) return;\n  modelShadowComparisonInFlight.add(field);\n\n  void supabase.functions.invoke(\n    'model-shadow-comparison',\n    { body: { field_id: field } },\n  ).then(({ data, error }) => {\n    if (error) throw error;\n    if (data?.ok === false) {\n      throw new Error(String(data?.error ?? 'Model shadow karşılaştırması çalıştırılamadı.'));\n    }\n  }).catch((error) => {\n    console.warn('[model-shadow-comparison] background comparison failed', error);\n  }).finally(() => {\n    modelShadowComparisonInFlight.delete(field);\n  });\n}\n'''
    service.write_text(text)

replace_once(
    'src/features/field-detail/components/SeasonModelInputs.tsx',
    '  ensureCropForgeShadowFreshBestEffort,\n',
    '  ensureModelShadowComparisonFreshBestEffort,\n',
    'SeasonModelInputs import',
)
replace_once(
    'src/features/field-detail/components/SeasonModelInputs.tsx',
    '    ensureCropForgeShadowFreshBestEffort(fieldId, 24);',
    '    ensureModelShadowComparisonFreshBestEffort(fieldId);',
    'SeasonModelInputs comparison trigger',
)

workflow = Path('.github/workflows/verify-main.yml')
text = workflow.read_text()
if 'Parse internal model comparison edge function' not in text:
    anchor = '''      - name: Run tests\n        run: npm test\n\n'''
    addition = '''      - name: Run tests\n        run: npm test\n\n      - name: Parse internal model comparison edge function\n        run: |\n          node - <<'NODE'\n          const fs = require('fs');\n          const ts = require('typescript');\n          const file = 'supabase/functions/model-shadow-comparison/index.ts';\n          const source = fs.readFileSync(file, 'utf8');\n          const out = ts.transpileModule(source, {\n            compilerOptions: {\n              target: ts.ScriptTarget.ES2022,\n              module: ts.ModuleKind.ESNext,\n            },\n            reportDiagnostics: true,\n          });\n          const errors = (out.diagnostics || []).filter(\n            (d) => d.category === ts.DiagnosticCategory.Error,\n          );\n          if (errors.length) {\n            console.error(errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\\n')).join('\\n'));\n            process.exit(1);\n          }\n          console.log('OK', file);\n          NODE\n\n'''
    if anchor not in text:
        raise SystemExit('verify-main anchor not found')
    workflow.write_text(text.replace(anchor, addition, 1))

Path('.github/apply-model-shadow-comparison.py').unlink(missing_ok=True)
Path('.github/workflows/apply-model-shadow-comparison.yml').unlink(missing_ok=True)
