import * as core from '@actions/core'
import path from 'path'
import {Test, runAll} from './runner.js'
import {pathToFileURL} from 'url'

const run = async (): Promise<void> => {
  try {
    const cwd = process.env['GITHUB_WORKSPACE']
    if (!cwd) {
      throw new Error('No GITHUB_WORKSPACE')
    }

    // Construct a file:// URL dynamically so ncc ignores it
    const jsonPath = path.resolve(cwd, '.github/classroom/autograding.json')
    const fileUrl = pathToFileURL(jsonPath).href

    // Load the external file strictly at runtime
    const {default: data} = await import(fileUrl, {with: {type: 'json'}})
    const json = JSON.parse(data.toString())

    await runAll(json.tests as Array<Test>, cwd)
  } catch (error) {
    // If there is any error we'll fail the action with the error message
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error('Unknown exception')
    }
    core.setFailed(`Autograding failure: ${error}`)
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run()
}

export default run
