import * as core from '@actions/core'
import fs from 'fs'
import path from 'path'
import {Test, runAll} from './runner.js'
//import {pathToFileURL} from 'url'
//import {createRequire} from 'module'

const run = async (): Promise<void> => {
  try {
    const cwd = process.env['GITHUB_WORKSPACE']
    if (!cwd) {
      throw new Error('No GITHUB_WORKSPACE')
    }
    // 1. Break up the target string into an array.
    // This stops ncc from tracking the literal file path at build time.
    const pathSegments = ['.github', 'classroom', 'autograding.json']

    // 2. Resolve the path normally.
    const targetPath = path.resolve(cwd, ...pathSegments)

    // 3. Use bracket notation to read the file.
    // This stops ncc from rewriting the path execution context during bundling.
    const readMethod = 'readFileSync'
    const data = fs[readMethod](targetPath)
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
