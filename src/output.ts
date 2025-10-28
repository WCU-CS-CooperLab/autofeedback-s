import * as core from '@actions/core'
import * as github from '@actions/github'

export const setCheckRunOutput = async (
  text: string,
  suffix: string,
  level: 'failure' | 'notice' | 'warning' = 'notice',
): Promise<void> => {
  // If we have nothing to output, then bail
  if (text === '') return
  const legalNotices = ['notice', 'error', 'warning']
  if (!level || !legalNotices.includes(level)) {
    level = 'notice'
  }

  // Our action will need to API access the repository so we require a token
  // This will need to be set in the calling workflow, otherwise we'll exit
  const token = process.env['GITHUB_TOKEN'] || core.getInput('token')
  if (!token || token === '') return

  // Create the octokit client
  const octokit = github.getOctokit(token)
  if (!octokit) return

  // The environment contains a variable for current repository. The repository
  // will be formatted as a name with owner (`nwo`); e.g., jeffrafter/example
  // We'll split this into two separate variables for later use
  const nwo = process.env['GITHUB_REPOSITORY'] || '/'
  const [owner, repo] = nwo.split('/')
  if (!owner) return
  if (!repo) return

  // We need the workflow run id
  const runId = parseInt(process.env['GITHUB_RUN_ID'] || '')
  if (Number.isNaN(runId)) return

  // Fetch the workflow run
  const workflowRunResponse = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId,
  })

  // Find the check suite run
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checkSuiteUrl = (workflowRunResponse.data as any).check_suite_url
  const checkSuiteId = parseInt(checkSuiteUrl.match(/[0-9]+$/)[0], 10)
  const checkRunsResponse = await octokit.rest.checks.listForSuite({
    owner,
    repo,
    check_name: 'Autograding',
    check_suite_id: checkSuiteId,
  })
  const checkRun = checkRunsResponse.data.total_count === 1 && checkRunsResponse.data.check_runs[0]
  if (!checkRun) return

  // Split text into chunks of 65,000 characters max
  const maxChars = 65000
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += MAX_CHARS) {
    chunks.push(text.substring(i, i + MAX_CHARS))
  }

  // Create annotations from chunks
  const annotations = chunks.map((chunk, index) => ({
    path: '.github',
    start_line: 1,
    end_line: 1,
    annotation_level: level,
    message: chunk,
    title: `Autograding ${suffix} (${index + 1}/${chunks.length})`,
  }))

  // Update the checkrun, we'll assign the title, summary and text even though we expect
  // the title and summary to be overwritten by GitHub Actions (they are required in this call)
  // We'll also store the total in an annotation to future-proof
  await octokit.rest.checks.update({
    owner,
    repo,
    check_run_id: checkRun.id,
    output: {
      title: 'Autograding',
      summary: text.substring(0, 1000),
      text: text,
      annotations,
    },
  })
}
