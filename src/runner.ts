import {spawn, ChildProcess} from 'child_process'
import kill from 'tree-kill'
import {v4 as uuidv4} from 'uuid'
import * as core from '@actions/core'
import {setCheckRunOutput} from './output'
import * as os from 'os'
import chalk from 'chalk'
import {fuzzySearch} from './fuzzySearch'
import * as fs from 'fs'
import * as path from 'path';


const color = new chalk.Instance({level: 1})

export type TestComparison = 'exact' | 'included' | 'regex'

export interface Test {
  readonly name: string
  readonly setup: string
  readonly run: string
  readonly input?: string
  readonly output?: string
  readonly timeout: number
  readonly points?: number
  readonly extra?: boolean
  readonly comparison: TestComparison
}

export class TestError extends Error {
  constructor(message: string) {
    super(message)
    Error.captureStackTrace(this, TestError)
  }
}

export class TestTimeoutError extends TestError {
  constructor(message: string) {
    super(message)
    Error.captureStackTrace(this, TestTimeoutError)
  }
}

export class TestOutputError extends TestError {
  expected: string
  actual: string

  constructor(message: string, expected: string, actual: string) {
    super(`${message}
    Expected Regular Expression (regex) Match:
${expected}
    Actual:
${actual}`)

    this.expected = expected
    this.actual = actual

    Error.captureStackTrace(this, TestOutputError)
  }
}

const log = (text: string): void => {
  process.stdout.write(text + os.EOL)
}

// --- Ported from runner.py: derive_status_and_summary / render_release_body
// Kept byte-for-byte equivalent in behavior (not just similar wording) so a
// submission graded through this TypeScript bridge produces the same
// classroom50/autograde commit-status text and release Markdown as one
// graded straight through runner.py.
type ResultPayload = {
  score?: number
  'max-score'?: number
  assignment?: string
  tests?: Array<{
    'test-name'?: string
    passed?: boolean
    score?: number
    'max-score'?: number
  }>
}

const deriveStatusAndSummary = (result: ResultPayload): [string, string] => {
  const tests = result.tests || []
  const score = result.score || 0
  const maxScore = result['max-score'] || 0
  const assignment = result.assignment || 'assignment'

  if (tests.length === 0) {
    return [
      'success',
      `classroom50 autograde: submitted — no autograder configured for ${assignment}`,
    ]
  }

  const passedCount = tests.filter((t) => t.passed).length
  const total = tests.length
  if (passedCount === total) {
    return ['success', `classroom50 autograde: ${score}/${maxScore} (all tests passed)`]
  }
  return [
    'failure',
    `classroom50 autograde: ${score}/${maxScore} (${passedCount}/${total} tests passed)`,
  ]
}

const renderReleaseBody = (result: ResultPayload, summary: string): string => {
  const score = result.score || 0
  const maxScore = result['max-score'] || 0
  const tests = result.tests || []

  const lines = [`### classroom50 autograde: ${score}/${maxScore}`, '']
  if (tests.length > 0) {
    lines.push('| Test | Result | Score |')
    lines.push('|---|---|---|')
    for (const t of tests) {
      const ok = t.passed ? 'PASS' : 'FAIL'
      const testName = (t['test-name'] || '').replace(/\|/g, '\\|')
      lines.push(`| ${testName} | ${ok} | ${t.score || 0} / ${t['max-score'] || 0} |`)
    }
    lines.push('')
    lines.push(`Status: ${summary}`)
  } else {
    lines.push(`_${summary}_`)
  }
  return lines.join('\n') + '\n'
}

const normalizeLineEndings = (text: string): string => {
  return text.replace(/\r\n/gi, '\n').trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const indent = (text: any): string => {
  let str = '' + new String(text)
  str = str.replace(/\r\n/gim, '\n').replace(/\n/gim, '\n  ')
  return str
}

const compareLines = (actualLine: string, expectedLine: string): string => {
  const result = []
  //let cActual = ``
  //let cExpected = ``
  if (actualLine == expectedLine) {
    result.push(`🟩Expected: "` + expectedLine + `"`)
    result.push(`🟩  Actual: "` + actualLine + `"`)
  } else {
    const diff = [...expectedLine]
    for (let j = 0; j < expectedLine.length; j++) {
      if (actualLine[j] != expectedLine[j]) {
        //cActual = actualLine[j]
        //cExpected = expectedLine[j]
        diff[j] = `^`
      } else {
        diff[j] = `_`
      }
    }

    const diffLine = diff.join('')
    result.push(`🟥EXPECTED: "` + expectedLine + `"`)
    result.push(`🟥  ACTUAL: "` + actualLine + `"`)
    result.push(`🟥           ` + diffLine)
    result.push(``)
    //if (expectedLine.length >= actualLine.length) {
    //  result.push(`🟥Character '` + cActual + `' does not match expected character '` + cExpected + `'`)
    //  result.push(``)
    //}
    //result.push(`🟥Note: If both lines look the same, then it could be the an`)
    //result.push(`🟥invisible whitespace such as a tab or newline. Highlighting`)
    //result.push(`🟥and/or copying each line could help you figure out if there`)
    //result.push(`🟥are hidden whitespace characters.`)
  }
  return result.join(os.EOL)
}

const waitForExit = async (child: ChildProcess, timeout: number): Promise<void> => {
  // eslint-disable-next-line no-undef
  return new Promise((resolve, reject) => {
    let timedOut = false

    const exitTimeout = setTimeout(() => {
      timedOut = true
      reject(new TestTimeoutError(`Setup timed out in ${timeout} milliseconds`))
      if (typeof child.pid === 'number') kill(child.pid)
    }, timeout)

    child.once('exit', (code: number, signal: string) => {
      if (timedOut) return
      clearTimeout(exitTimeout)

      if (code === 0) {
        resolve(undefined)
      } else {
        reject(new TestError(`Error: Exit with code: ${code} and signal: ${signal}`))
      }
    })

    child.once('error', (error: Error) => {
      if (timedOut) return
      clearTimeout(exitTimeout)

      reject(error)
    })
  })
}

const runSetup = async (test: Test, cwd: string, timeout: number): Promise<void> => {
  if (!test.setup || test.setup === '') {
    return
  }

  const setup = spawn(test.setup, {
    cwd,
    shell: true,
    env: {
      PATH: process.env['PATH'],
      FORCE_COLOR: 'true',
    },
  })

  let output = ''

  // Start with a single new line
  process.stdout.write(indent('\n'))

  setup.stdout.on('data', (chunk) => {
    process.stdout.write(indent(chunk))
    output += chunk
  })

  setup.stderr.on('data', (chunk) => {
    process.stderr.write(indent(chunk))
    output += chunk
  })

  try {
    await waitForExit(setup, timeout)
  } catch (error) {
    if (error instanceof TestTimeoutError) {
      throw new TestTimeoutError(output + '\n' + error.message)
    } else if (error instanceof TestError) {
      throw new TestError(output + '\n' + error.message)
    } else if (error instanceof Error) {
      throw new Error(output + '\n' + error.message)
    } else {
      throw new Error(output + '\nUnknown ERROR: ' + `${error}`)
    }
  }
}

// function throwError(header:string,exp:string,act:string) {
//   return new Promise((resolve) => {
//       core.error(`${header}\nExpected:\n${exp}\nActual:\n${act}`)
//       resolve("test")
//   });

// }

const runCommand = async (test: Test, cwd: string, timeout: number) => {
  const child = spawn(test.run, {
    cwd,
    shell: true,
    env: {
      PATH: process.env['PATH'],
      FORCE_COLOR: 'true',
    },
  })

  let output = ''

  // Start with a single new line
  process.stdout.write(indent('\n'))

  child.stdout.on('data', (chunk) => {
    process.stdout.write(indent(chunk))
    output += chunk
  })

  child.stderr.on('data', (chunk) => {
    process.stderr.write(indent(chunk))
    output += chunk
  })

  // Preload the inputs
  if (test.input && test.input !== '') {
    child.stdin.write(test.input)
    child.stdin.end()
  }
  try {
    await waitForExit(child, timeout)
  } catch (error) {
    if (error instanceof TestTimeoutError) {
      throw new TestTimeoutError(output + '\n' + error.message)
    } else if (error instanceof TestError) {
      throw new TestError(output + '\n' + error.message)
    } else if (error instanceof Error) {
      throw new Error(output + '\n' + error.message)
    } else {
      throw new Error(output + '\nUnknown ERROR: ' + `${error}`)
    }
  }

  // Eventually work off the the test type
  if ((!test.output || test.output == '') && (!test.input || test.input == '')) {
    return output
  }

  const expected = normalizeLineEndings(test.output || '')
  const actual = normalizeLineEndings(output)

  const exactDiffMessage = (actual: string, expected: string): string => {
    const linesActual = actual.split(/\r?\n/)
    const linesExpected = expected.split(/\r?\n/)
    const minLines = Math.min(linesActual.length, linesExpected.length)
    const result = []
    result.push('')
    result.push('Full program output:')
    result.push(actual)
    result.push('')
    result.push('Full expected output for this test:')
    result.push(expected)
    result.push(``)
    result.push(`Num lines to test ` + linesExpected.length)
    result.push(`  Num lines total ` + linesActual.length)
    if (linesExpected.length > linesActual.length) {
      result.push(` missing ` + (linesExpected.length - linesActual.length) + ` lines of output`)
    } else if (linesExpected.length < linesActual.length) {
      result.push(` extra ` + (linesActual.length - linesExpected.length) + ` lines of output`)
    } else {
      result.push(`line count is correct.`)
    }
    let cActual = ``
    let cExpected = ``
    let expectedLine = ``
    let actualLine = ``

    result.push(``)
    // Look at each line
    if (linesExpected.length == linesActual.length) {
      for (let i = 0; i < minLines; i++) {
        expectedLine = linesExpected[i]
        actualLine = linesActual[i]

        if (actualLine == expectedLine) {
          result.push(`🟩Line ` + i + `\tExpected: "` + expectedLine + `"`)
          result.push(`🟩Line ` + i + `\t  Actual: "` + actualLine + `"`)
        } else {
          result.push(`🟥------- Mismatch on line ` + i)
          const diff = [...expectedLine]
          for (let j = 0; j < expectedLine.length; j++) {
            if (actualLine[j] != expectedLine[j]) {
              cActual = actualLine[j]
              cExpected = expectedLine[j]
              diff[j] = `^`
            } else {
              diff[j] = `_`
            }
          }

          const diffLine = diff.join('')
          result.push(``)
          result.push(`🟥EXPECTED: "` + expectedLine + `"`)
          result.push(`🟥  ACTUAL: "` + actualLine + `"`)
          result.push(`🟥           ` + diffLine)
          result.push(``)
          if (expectedLine.length >= actualLine.length) {
            result.push(`🟥Character '` + cActual + `' does not match expected character '` + cExpected + `'`)
            result.push(``)
          }
          result.push(`🟥Note: If both lines look the same, then it could be the an`)
          result.push(`🟥invisible whitespace such as a tab or newline. Highlighting`)
          result.push(`🟥and/or copying each line could help you figure out if there`)
          result.push(`🟥are hidden whitespace characters.`)
          return result.join(os.EOL)
        }
      }
    } else {
      result.push(`comparing each line of expected output against each line of actual output`)
      for (let k = 0; k < linesExpected.length; ++k) {
        expectedLine = linesExpected[k]
        for (let l = 0; l < linesActual.length; ++l) {
          actualLine = linesActual[l]
          const compare = compareLines(actualLine, expectedLine)
          result.push(`expected line ` + k + ` actual line ` + l)
          result.push(compare)
        }
      }
    }
    return result.join(os.EOL)
  }

  const includedDiffMessage = (actual: string, expected: string): string => {
    const actualLines = actual.split(/\r?\n/)

    const result = ['  ']
    result.push('')
    result.push('Full program output:')
    result.push(actual)
    result.push('')
    result.push('Included string expected for this test:')
    result.push(expected)
    result.push('')

    const closest = fuzzySearch(actual, expected)
    result.push(`🟥------- Expected text not found `)
    result.push('')
    result.push('🟥EXPECTED: "' + expected + '"')

    // We do not want to consider line endings in the number in character counts
    const closestIndex = actual.replace(/\r?\n/g, '').indexOf(closest)
    let charCount = 0
    let currLine = 1
    while (charCount < closestIndex) {
      charCount += actualLines[currLine - 1].length
      currLine++
    }

    result.push('🟥 CLOSEST: "' + closest + '" starting on line ' + currLine + ' pos ' + closestIndex)
    result.push('')

    return result.join(os.EOL)
  }

  switch (test.comparison) {
    case 'exact':
      if (actual != expected) {
        //core.group(`Error: ${test.name}`, async() => {
        const result = exactDiffMessage(actual, expected)
        throw new TestError(`The output for test ${test.name} does not match:
${result}`)
        //throw new TestOutputError(`The output for test ${test.name} did not match`, expected, actual)
        //core.endGroup()
      }
      break
    case 'regex':
      // Note: do not use expected here
      if (!actual.match(new RegExp(test.output || ''))) {
        //core.startGroup(`Error: ${test.name}`)
        throw new TestOutputError(`The output for test ${test.name} did not match`, test.output || '', actual)
        //core.endGroup()
      }
      break
    default:
      // The default comparison mode is 'included'
      if (!actual.includes(expected)) {
        //core.group(`Error: ${test.name}`, async() => {
        const result = includedDiffMessage(actual, expected)
        throw new TestError(`The output for test ${test.name} did not match:
${result}`)
        //throw new TestOutputError(`The output for test ${test.name} did not match`, expected, actual)
        //core.endGroup()
      }
      break
  }
  return output
}

export const run = async (test: Test, cwd: string) => {
  // Timeouts are in minutes, but need to be in ms
  let timeout = (test.timeout || 1) * 60 * 1000 || 30000
  const start = process.hrtime()
  await runSetup(test, cwd, timeout)
  const elapsed = process.hrtime(start)
  // Subtract the elapsed seconds (0) and nanoseconds (1) to find the remaining timeout
  timeout -= Math.floor(elapsed[0] * 1000 + elapsed[1] / 1000000)
  const result = await runCommand(test, cwd, timeout)
  return result
}

export const runAll = async (tests: Array<Test>, cwd: string): Promise<void> => {
  let points = 0
  let availablePoints = 0
  let passed = 0
  let numtests = 0
  let hasPoints = false

  let failed = false
  const passing = []
  const failing = []
  const summaryMsgs = []
  const errMsgs = []

  // Per-test breakdown for the classroom50/result/v1 "tests" array.
  // One entry is pushed per test, whether it passes or fails.
  interface TestResultEntry {
    'test-name': string
    passed: boolean
    score: number
    'max-score': number
  }
  const testResults: TestResultEntry[] = []

  for (const test of tests) {
    if (!test.extra) {
      numtests += 1
    }
    log('')
    // https://help.github.com/en/actions/reference/development-tools-for-github-actions#stop-and-start-log-commands-stop-commands
    const token = uuidv4()
    log('')
    log(`::stop-commands::${token}`)
    log('')

    try {
      if (test.points) {
        hasPoints = true
        if (!test.extra) {
          availablePoints += test.points
        }
      }
      log(color.cyan(`📝 ${test.name}`))

      const result = await run(test, cwd)
      // Restart command processing
      log('')
      log(`::${token}::`)

      log('')
      log(color.green(`🏁 completed - ${test.name}`))
      log(``)
      let notice = `🏁 Passed ${test.name}\n`
      notice += '\n' + result + '\n'
      //core.notice(notice, nAnn)
      //log(`about to call setCheckRunOutput\n`)
      //log(`Original text length: ${notice.length}\n`)

      await setCheckRunOutput(notice, test.name)

      if (test.points) {
        points += test.points
      }

      if (!test.extra) {
        passing.push(test.name)
        passed += 1
        // default to 1/1 if there are no points
        testResults.push({
          'test-name': test.name,
          passed: true,
          score: test.points || 1,
          'max-score': test.points || 1,
        })
      } else {
        // max score is 0 on extra credit
        testResults.push({
          'test-name': test.name,
          passed: true,
          score: test.points || 1,
          'max-score': 0,
        })
      }

      
    } catch (error) {
      log('')
      // Restart command processing
      log('')
      log(`::${token}::`)
      log(color.yellow(`🚧 needs repair - ${test.name}`))
      if (!test.extra) {
        failing.push(test.name)
        failed = true
        if (error instanceof Error) {
          let eMsg = `🚧 Needs Repair - ${test.name}\n`
          eMsg += error.message + '\n'
          const errors = []
          errors.push(error.message)
          if (error.message.indexOf('regex') != -1) {
            const sText =
              '**' +
              test.name +
              ' Note:** Go to [debuggex](https://www.debuggex.com) for help with regular expression problems. It will take the *Expected* text in the first box and the *Actual* text in the second box and show you a *red line* for where the test fails.'

            const eText = `Note: Go to https://www.debuggex.com for help with regular expression problems. It will take the Expected text in the first box and the Actual text in the second box and show you a red line for where the test fails.`
            eMsg += eText
            summaryMsgs.push(sText)
            errMsgs.push(test.name + ' ' + eText)
            errors.push(eText)
          }
          //core.error(eMsg, eAnn)
          await setCheckRunOutput(eMsg, test.name, 'failure')
          //core.summary.write()
          log(errors.join(os.EOL))
        } else {
          let eMsg = `🚧 Needs Repair - ${test.name}\n`
          eMsg += `Unknown Exception: ${error}`
          await setCheckRunOutput(eMsg, test.name, 'failure')
          //core.error(eMsg, eAnn)
          log(`Unknown exception: ${error}`)
        }
        testResults.push({
          'test-name': test.name,
          passed: false,
          score: 0,
          'max-score': test.points || 1,
        })
      } else{
        testResults.push({
          'test-name': test.name,
          passed: false,
          score: 0,
          'max-score': 0,
        })
      }

      
    }
  }

  if (failed) {
    // We need a good failure experience
    log('')
    log(color.red('At least one test failed'))
    log('')
    log('Please, look at the output and make sure it makes sense to you.')
    log(' If it does, then check the requirements to see what formatting may need to change.')
    log('')
  } else {
    log('')
    log(color.green('All tests passed'))
    log('')
    log('Please, still look at the output and make sure it looks right to you.')
    log('')
    log('✨🌟💖💎🦄💎💖🌟✨🌟💖💎🦄💎💖🌟✨')
    log('')
  }

  if (points > availablePoints) {
    const extraCreditPoints = 1 * (points - availablePoints)
    log(`💪💪💪 You earned ${extraCreditPoints} extra credit points`)
    log('')
  }

  let text = `Tests Passed: ${passed}/${numtests}  
  Passing tests: ${passing}  
  Failing tests: ${failing}\n`

  core.summary.addRaw('## Test Summary', true)
  core.summary.addRaw(text, true)
  core.summary.addRaw(summaryMsgs.join(os.EOL), true)
  core.summary.addRaw('Check *Annotations* for individual test results', true)
  core.summary.write()
  //log(color.bold.bgCyan.black(text))
  text += errMsgs.join(os.EOL) + '\n'
  text += 'Check Annotations for individual test results\n'
  log(color.bold.bgCyan.black(text))
  log('')
  log('')

  //core.notice(text, {title: 'Testing Summary'})
  await setCheckRunOutput(text, 'Summary')

  // Set the number of points
  if (hasPoints) {
    const text = `Points ${points}/${availablePoints}`
    log(color.bold.bgCyan.black(text))
    core.setOutput('Points', `${points}/${availablePoints}`)
    await setCheckRunOutput(text, 'complete')
    //core.notice(text, {title: 'Autograding complete'})
  } else {
    // set the number of tests that passed
    const text = `Points ${passed}/${numtests}`
    //Passing tests: ${passing}
    //Failing tests: ${failing}`
    //log(color.bold.bgCyan.black(text))
    log(color.bold.bgCyan.black(text))
    core.setOutput('Points', `${passed}/${numtests}`)
    await setCheckRunOutput(text, 'complete')
    //core.notice(text, {title: 'Autograding complete'})
  }

  let finalScore = 0
  let finalMaxScore = 0

  if (hasPoints) {
    finalScore = points
    finalMaxScore = availablePoints
  } else {
    finalScore = passed
    finalMaxScore = numtests
  }

  try {
    // autofeedback-s is invoked directly as an Action step in autograde.yaml
    // — runner.py is never in this loop, so USERNAME/COMMIT_URL/RELEASE_URL/
    // ASSIGNMENT_TYPE (which only ever existed because runner.py injected
    // them into a subprocess it spawned) are NOT available here. Everything
    // below is derived instead from the standard GITHUB_* context vars every
    // step gets for free, plus MODE (which IS in the grade job's own env:
    // block, sourced from assignments.json). Getting `owner` wrong/empty is
    // what silently drops a submission from collect-scores — that field is
    // the identity anchor it validates against the source repo.
    const repoSlug = process.env.GITHUB_REPOSITORY || ''
    const owner = process.env.GITHUB_REPOSITORY_OWNER || repoSlug.split('/')[0] || ''
    const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com'
    const sha = process.env.GITHUB_SHA || ''
    const submissionTag = process.env.SUBMISSION_TAG || ''
    const assignmentType = process.env.MODE === 'group' ? 'group' : 'individual'

    // The release doesn't exist yet at grading time (it's created by a
    // later workflow step, from this very result.json) — so this is the
    // predictable URL a submit/* tag's release resolves to once created,
    // not a lookup. GitHub Release tag URLs percent-encode '/' as %2F.
    const releaseUrl = repoSlug && submissionTag
      ? `${serverUrl}/${repoSlug}/releases/tag/${encodeURIComponent(submissionTag)}`
      : ''
    const commitUrl = repoSlug && sha ? `${serverUrl}/${repoSlug}/commit/${sha}` : ''

    const result = {
      schema: 'classroom50/result/v1',
      classroom: process.env.CLASSROOM || '',
      assignment: process.env.ASSIGNMENT || '',
      assignment_type: assignmentType as 'individual' | 'group',
      owner,
      submission: submissionTag,
      commit: commitUrl,
      release: releaseUrl,
      // TODO: a true starter->graded-commit diff needs the baseline commit
      // (the one that added .classroom50.yaml), which isn't resolved
      // anywhere in this bridge yet — same gap as baseline-sha/head-sha for
      // the Feedback PR step. Falling back to the commit URL for now rather
      // than leaving this empty.
      review: commitUrl,
      datetime: new Date().toISOString(),
      score: finalScore,
      'max-score': finalMaxScore,
      tests: testResults,
    }

    const resultJson = JSON.stringify(result, null, 2)

    // Working directory is the student's checkout, and result.json is
    // required to land there as a relative "./result.json".
    const resultFilePath = path.join(cwd, 'result.json')
    fs.writeFileSync(resultFilePath, resultJson, 'utf-8')
    log(`Wrote grading payload to: ${resultFilePath}`)

    // release-body.md is optional per the contract (the runner synthesizes
    // it when absent), but ported here for parity with runner.py so
    // submissions graded through this bridge get the same Markdown body —
    // score line + per-test table — as ones graded straight through
    // runner.py, instead of falling back to whatever generic body the
    // runner synthesizes for "autograder produced no release-body.md".
    const [status, summary] = deriveStatusAndSummary(result)
    const releaseBody = renderReleaseBody(result, summary)
    const releaseBodyPath = path.join(cwd, 'release-body.md')
    fs.writeFileSync(releaseBodyPath, releaseBody, 'utf-8')
    log(`Wrote release body to: ${releaseBodyPath} (status: ${status})`)

    // autograde.yaml's set-latest job, the "Post commit status" step, and
    // the "Publish submission release" step all key off
    // steps.autograde.outputs.status/summary. Without these, that output
    // is always empty — set-latest's condition
    // (needs.grade.outputs.status == 'success' || ... == 'failure')
    core.setOutput('status', status)
    core.setOutput('summary', summary)
  } catch (error: any) {
    // Set failure when results.json isn't created.
    // Still emit status/summary outputs (matching runner.py's error() path)
    // so "Post commit status" reports something specific instead of falling
    // back to its own generic default
    const errorSummary = `classroom50 autograde: ${error.message}`
    core.setOutput('status', 'error')
    core.setOutput('summary', errorSummary)
    core.setFailed(`Autograding complete but score delivery failed: ${error.message}`)
  }
}
