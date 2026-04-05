<script lang="ts">
  import type { PageData } from './$types';
  import type { Run } from '$lib/types';
  import { diffText } from '$lib/diff';

  let { data }: { data: PageData } = $props();

  let selected = $state<Run>(data.runs[0]);
  let activeTab = $state<'metrics' | 'instructions'>('metrics');

  function fmt(n: number | null | undefined, decimals = 2) {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(decimals);
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString();
  }

  let allEssays = $derived(
    selected.essays
      ? Object.values(selected.essays)
      : (selected as any).results ?? []
  );

  let criteriaKeys = $derived(Object.keys(selected.metrics.criteria).sort());

  let prev = $derived(() => {
    const idx = data.runs.indexOf(selected);
    return idx < data.runs.length - 1 ? data.runs[idx + 1] : null;
  });

  let sysDiff = $derived(
    prev() ? diffText(prev()!.metadata.system_instructions, selected.metadata.system_instructions) : null
  );
  let rubricDiff = $derived(
    prev() ? diffText(prev()!.metadata.rubric, selected.metadata.rubric) : null
  );

  let search = $state('');
  let filter = $state<'all' | 'exact' | 'problematic'>('all');

  let filteredEssays = $derived(
    allEssays
      .filter(e => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          e.essay_id?.toLowerCase().includes(q) ||
          e.essay_name?.toLowerCase().includes(q) ||
          e.prompt?.toLowerCase().includes(q)
        );
      })
      .filter(e => {
        if (filter === 'exact') return e.total_diff === 0;
        if (filter === 'problematic') return Math.abs(e.total_diff) >= 1;
        return true;
      })
      .sort((a, b) => Math.abs(b.total_diff) - Math.abs(a.total_diff))
  );

  let expandedRows = $state<Set<number>>(new Set());

  function toggleRow(i: number) {
    const next = new Set(expandedRows);
    next.has(i) ? next.delete(i) : next.add(i);
    expandedRows = next;
  }

  function selectRun(run: Run) {
    selected = run;
    search = '';
    filter = 'all';
    expandedRows = new Set();
    activeTab = 'metrics';
  }
</script>

<div class="shell">

  <!-- Sidebar -->
  <aside class="sidebar">
    <p class="sidebar-label">Runs</p>
    {#each data.runs as run, i (run.id)}
      <button
        class="run-btn"
        class:active={run === selected}
        onclick={() => selectRun(run)}
      >
        <div class="run-top">
          <span class="run-num">Run {data.runs.length - i}</span>
          <span class="mae-badge" class:good={run.metrics.mae <= 0.5} class:warn={run.metrics.mae > 0.5}>
            {fmt(run.metrics.mae)}
          </span>
        </div>
        <span class="run-ts">{new Date(run.metadata.timestamp).toLocaleDateString()}</span>
        <span class="run-essays">{run.metrics.n} essays · {run.metrics.failed} failed</span>
      </button>
    {/each}
  </aside>

  <!-- Main -->
  <main class="main">

    <!-- Header -->
    <div class="header">
      <h1>{selected.id}</h1>
      <p class="subtitle">
        {fmtDate(selected.metadata.timestamp)} · {selected.metrics.n} essays ·
        mean bias {selected.metrics.mean_bias >= 0 ? '+' : ''}{fmt(selected.metrics.mean_bias, 3)} pts
      </p>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      {#each [['metrics', 'Metrics & essays'], ['instructions', 'System instructions']] as [val, label] (val)}
        <button
          class="tab"
          class:active={activeTab === val}
          onclick={() => activeTab = val as typeof activeTab}
        >{label}</button>
      {/each}
    </div>

    <!-- ── TAB: METRICS ── -->
    {#if activeTab === 'metrics'}

      <!-- Summary cards -->
      <div class="cards">
        {#each [
          { label: 'Essays',      val: selected.metrics.n },
          { label: 'Failed',      val: selected.metrics.failed },
          { label: 'MAE',         val: fmt(selected.metrics.mae, 3) + ' pts' },
          { label: 'RMSE',        val: fmt(selected.metrics.rmse, 3) + ' pts' },
          { label: 'Exact match', val: fmt(selected.metrics.exact_pct, 1) + '%' },
          { label: 'Within ½ pt', val: fmt(selected.metrics.close_pct, 1) + '%' },
          { label: 'Mean bias',   val: (selected.metrics.mean_bias >= 0 ? '+' : '') + fmt(selected.metrics.mean_bias, 3) + ' pts' },
          { label: 'Problematic', val: allEssays.filter(e => Math.abs(e.total_diff) >= 1).length },
        ] as card (card.label)}
          <div class="card">
            <p class="card-label">{card.label}</p>
            <p class="card-val">{card.val}</p>
          </div>
        {/each}
      </div>

      <div class="divider"></div>

      <!-- Per-criterion accuracy -->
      <h2>Per-criterion accuracy</h2>
      <p class="hint">Positive bias = AI scores higher than real graders on average.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Criterion</th>
              <th class="num">N</th>
              <th class="num">MAE</th>
              <th class="num">Mean bias</th>
              <th class="num">Exact %</th>
            </tr>
          </thead>
          <tbody>
            {#each criteriaKeys as k (k)}
              {@const c = selected.metrics.criteria[k]}
              <tr>
                <td>{k} — {c.name}</td>
                <td class="num">{c.n}</td>
                <td class="num">{fmt(c.mae)}</td>
                <td class="num" class:pos={c.mean_bias > 0.05} class:neg={c.mean_bias < -0.05}>
                  {c.mean_bias >= 0 ? '+' : ''}{fmt(c.mean_bias)}
                </td>
                <td class="num">{fmt(c.exact_pct, 1)}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="divider"></div>

      <!-- All essays -->
      <h2>All essays</h2>
      <div class="toolbar">
        <input
          class="search"
          type="text"
          placeholder="Search essay ID or prompt…"
          bind:value={search}
        />
        <div class="filter-group">
          {#each [['all', 'All'], ['exact', 'Exact only'], ['problematic', 'Problematic']] as [val, label] (val)}
            <button
              class="filter-btn"
              class:active={filter === val}
              onclick={() => filter = val as typeof filter}
            >{label}</button>
          {/each}
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Essay</th>
              <th>Prompt</th>
              <th class="num">Real</th>
              <th class="num">AI</th>
              <th class="num">Diff</th>
              <th class="num">Possible</th>
              {#each criteriaKeys as k (k)}
                <th class="num">{k} ai/real</th>
                <th class="num">{k} diff</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each filteredEssays as essay, i (i)}
              {@const isOpen = expandedRows.has(i)}
              {@const absDiff = Math.abs(essay.total_diff)}

              <!-- Main row -->
              <tr
                class:flagged={absDiff >= 1}
                class="essay-row"
                onclick={() => toggleRow(i)}
              >
                <td class="expand-cell">
                  <span class="expand-icon">{isOpen ? '▼' : '▶'}</span>
                </td>
                <td class="essay-id">{essay.essay_id ?? essay.essay_name}</td>
                <td class="prompt-cell">{essay.prompt?.slice(0, 60)}…</td>
                <td class="num">{essay.real_total}</td>
                <td class="num">{fmt(essay.ai_total, 1)}</td>
                <td class="num" class:pos={essay.total_diff > 0} class:neg={essay.total_diff < 0}>
                  {essay.total_diff >= 0 ? '+' : ''}{fmt(essay.total_diff, 1)}
                </td>
                <td class="num">{essay.total_possible}</td>
                {#each criteriaKeys as k (k)}
                  {@const cd = essay.criteria_diffs?.[k]}
                  <td class="num">{cd?.ai ?? '—'}/{cd?.real ?? '—'}</td>
                  <td class="num" class:pos={cd?.diff != null && cd.diff > 0} class:neg={cd?.diff != null && cd.diff < 0}>
                    {cd?.diff != null ? (cd.diff >= 0 ? '+' : '') + fmt(cd.diff, 1) : '—'}
                  </td>
                {/each}
              </tr>

              <!-- Expanded detail row -->
              {#if isOpen}
                <tr class="detail-row" class:flagged={absDiff >= 1}>
                  <td colspan={7 + criteriaKeys.length * 2} class="detail-cell">
                    <div class="detail-body">

                      <p class="essay-prompt">{essay.prompt}</p>

                      <!-- Per-criterion feedback cards -->
                      {#each Object.entries(essay.criteria_diffs ?? {}).sort() as [letter, cd] (letter)}
                        <div class="criterion-card">
                          <div class="criterion-header">
                            <span class="criterion-title">{letter} — {cd.name}</span>
                            <div class="criterion-scores">
                              <span class="score-label">Real <strong>{cd.real}/{cd.possible}</strong></span>
                              <span class="score-label">AI <strong>{cd.ai ?? '—'}/{cd.possible}</strong></span>
                              <span
                                class="diff-pill"
                                class:diff-pos={cd.diff != null && cd.diff > 0}
                                class:diff-neg={cd.diff != null && cd.diff < 0}
                                class:diff-zero={cd.diff === 0}
                              >
                                {cd.diff != null ? (cd.diff >= 0 ? '+' : '') + fmt(cd.diff, 1) : '—'}
                              </span>
                            </div>
                          </div>

                          {#if cd.real_feedback || cd.reasoning}
                            <div class="feedback-columns">
                              <div class="feedback-col">
                                <p class="feedback-source">📋 Real feedback</p>
                                <p class="feedback-text">{cd.real_feedback || '—'}</p>
                              </div>
                              <div class="feedback-col ai-col">
                                <p class="feedback-source">🤖 AI reasoning</p>
                                <p class="feedback-text">{cd.reasoning || '—'}</p>
                              </div>
                            </div>
                          {/if}
                        </div>
                      {/each}

                      <!-- Overall AI feedback -->
                      {#if essay.areas_for_improvement?.length || essay.final_feedback}
                        <div class="criterion-card">
                          <div class="criterion-header">
                            <span class="criterion-title">Overall AI feedback</span>
                          </div>
                          <div class="overall-feedback">
                            {#if essay.areas_for_improvement?.length}
                              <div>
                                <p class="feedback-source">Areas for improvement</p>
                                <ul class="bullet-list">
                                  {#each essay.areas_for_improvement as item, j (j)}
                                    <li>{item}</li>
                                  {/each}
                                </ul>
                              </div>
                            {/if}
                            {#if essay.final_feedback}
                              <div>
                                <p class="feedback-source">Final feedback</p>
                                <p class="feedback-text">{essay.final_feedback}</p>
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/if}

                    </div>
                  </td>
                </tr>
              {/if}

            {/each}
            {#if filteredEssays.length === 0}
              <tr><td colspan="99" class="empty">No essays match.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>

    <!-- ── TAB: INSTRUCTIONS ── -->
    {:else}
      <div class="instructions-grid">

        <div class="instr-section">
          <h2>System instructions</h2>
          {#if !prev()}
            <p class="hint">First run — no diff available.</p>
            <pre class="code-block">{selected.metadata.system_instructions}</pre>
          {:else}
            <div class="diff-block">
              {#each sysDiff ?? [] as line, i (i)}
                <div class="diff-line {line.type}">{line.text}</div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="instr-section">
          <h2>Rubric</h2>
          {#if !prev()}
            <p class="hint">First run — no diff available.</p>
            <pre class="code-block">{selected.metadata.rubric}</pre>
          {:else if rubricDiff?.some(l => l.type !== 'same')}
            <div class="diff-block">
              {#each rubricDiff ?? [] as line, i (i)}
                <div class="diff-line {line.type}">{line.text}</div>
              {/each}
            </div>
          {:else}
            <p class="no-change">No changes from previous run.</p>
            <pre class="code-block">{selected.metadata.rubric}</pre>
          {/if}
        </div>

      </div>
    {/if}
  </main>
</div>

<style>
  /* ── Layout ── */
  .shell { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; font-family: system-ui, sans-serif; background: #faf9f7; color: #1c1c1c; }

  /* ── Sidebar ── */
  .sidebar { background: #fff; border-right: 1px solid #e8e6e1; padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .sidebar-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #aaa; padding: 2px 8px 6px; }
  .run-btn { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 8px; border: 1px solid transparent; background: none; cursor: pointer; text-align: left; width: 100%; transition: background 0.1s; }
  .run-btn:hover { background: #f5f4f1; }
  .run-btn.active { background: #fff; border-color: #ddd; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .run-top { display: flex; align-items: center; justify-content: space-between; }
  .run-num { font-size: 13px; font-weight: 500; }
  .run-ts { font-size: 11px; color: #999; }
  .run-essays { font-size: 11px; color: #bbb; }
  .mae-badge { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
  .mae-badge.good { background: #e6f4d7; color: #2d6a0a; }
  .mae-badge.warn { background: #fef0d0; color: #854f0b; }

  /* ── Main ── */
  .main { padding: 24px 28px; display: flex; flex-direction: column; gap: 18px; overflow-x: hidden; }
  .header h1 { font-size: 20px; font-weight: 500; margin: 0; }
  .subtitle { font-size: 12px; color: #999; margin: 3px 0 0; }

  /* ── Tabs ── */
  .tabs { display: flex; border-bottom: 1px solid #e8e6e1; }
  .tab { padding: 8px 16px; border: none; background: none; font-size: 13px; cursor: pointer; color: #aaa; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.1s; }
  .tab:hover { color: #555; }
  .tab.active { color: #111; border-bottom-color: #111; font-weight: 500; }

  /* ── Summary cards ── */
  .cards { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 10px; }
  .card { background: #fff; border: 1px solid #e8e6e1; border-radius: 10px; padding: 12px 14px; }
  .card-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 4px; }
  .card-val { font-size: 18px; font-weight: 500; margin: 0; }

  /* ── Misc ── */
  .divider { height: 1px; background: #e8e6e1; }
  h2 { font-size: 14px; font-weight: 600; margin: 0; }
  .hint { font-size: 12px; color: #aaa; margin: -10px 0 2px; }

  /* ── Tables ── */
  .table-wrap { overflow-x: auto; border: 1px solid #e8e6e1; border-radius: 10px; background: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e8e6e1; font-weight: 500; color: #999; font-size: 11px; white-space: nowrap; background: #faf9f7; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0ede8; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .pos { color: #c0392b; }
  .neg { color: #2d6a0a; }
  .essay-id { font-weight: 500; white-space: nowrap; }
  .prompt-cell { color: #777; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .flagged td { background: #fff8f8; }
  .empty { text-align: center; color: #bbb; padding: 24px; }

  /* ── Expandable rows ── */
  .essay-row { cursor: pointer; }
  .essay-row:hover td { background: #f5f4f1 !important; }
  .expand-cell { width: 28px; color: #bbb; font-size: 9px; }
  .expand-icon { display: inline-block; }
  .detail-row td { padding: 0; border-bottom: 1px solid #e8e6e1; }
  .detail-cell { padding: 0 !important; }
  .detail-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #fdfdfc; }

  /* ── Toolbar ── */
  .toolbar { display: flex; gap: 10px; align-items: center; }
  .search { flex: 1; max-width: 360px; padding: 7px 10px; border: 1px solid #e0ddd8; border-radius: 8px; font-size: 13px; outline: none; background: #fff; }
  .search:focus { border-color: #aaa; }
  .filter-group { display: flex; border: 1px solid #e0ddd8; border-radius: 8px; overflow: hidden; background: #fff; }
  .filter-btn { padding: 7px 12px; border: none; border-right: 1px solid #e0ddd8; background: #fff; font-size: 12px; cursor: pointer; }
  .filter-btn:last-child { border-right: none; }
  .filter-btn.active { background: #f0ede8; font-weight: 500; }

  /* ── Criterion cards ── */
  .essay-prompt { font-size: 12px; color: #777; margin: 0; line-height: 1.6; }
  .criterion-card { border: 1px solid #e8e6e1; border-radius: 10px; overflow: hidden; }
  .criterion-header { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; background: #faf9f7; border-bottom: 1px solid #e8e6e1; }
  .criterion-title { font-size: 12px; font-weight: 600; }
  .criterion-scores { display: flex; align-items: center; gap: 12px; }
  .score-label { font-size: 11px; color: #999; }
  .score-label strong { color: #333; font-weight: 600; }
  .diff-pill { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; background: #f0ede8; color: #888; }
  .diff-pill.diff-pos { background: #fdecea; color: #c0392b; }
  .diff-pill.diff-neg { background: #e6f4d7; color: #2d6a0a; }
  .diff-pill.diff-zero { background: #f0ede8; color: #888; }

  /* ── Side-by-side feedback ── */
  .feedback-columns { display: grid; grid-template-columns: 1fr 1fr; }
  .feedback-col { padding: 12px 14px; }
  .ai-col { background: #fdfcfb; border-left: 1px solid #f0ede8; }
  .feedback-source { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #bbb; margin: 0 0 6px; }
  .feedback-text { font-size: 12px; color: #555; line-height: 1.65; margin: 0; }
  .overall-feedback { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
  .bullet-list { font-size: 12px; color: #555; padding-left: 18px; margin: 4px 0 0; line-height: 1.8; }

  /* ── Instructions tab ── */
  .instructions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .instr-section { display: flex; flex-direction: column; gap: 10px; }
  .code-block { font-family: monospace; font-size: 12px; background: #f5f4f1; border: 1px solid #e8e6e1; border-radius: 8px; padding: 12px 14px; white-space: pre-wrap; word-break: break-word; margin: 0; max-height: 400px; overflow-y: auto; }
  .diff-block { font-family: monospace; font-size: 12px; border: 1px solid #e8e6e1; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; max-height: 400px; overflow-y: auto; background: #fff; }
  .diff-line { padding: 1px 4px; border-radius: 2px; white-space: pre-wrap; word-break: break-word; }
  .diff-line.same { color: #666; }
  .diff-line.added { background: #e6f4d7; color: #2d6a0a; }
  .diff-line.removed { background: #fdecea; color: #c0392b; }
  .no-change { font-size: 12px; color: #bbb; margin: 0; }
</style>