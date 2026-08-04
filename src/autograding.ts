import * as core from '@actions/core'
import path from 'path'
import {Test, runAll} from './runner.js'
import {pathToFileURL} from 'url'
//import {createRequire} from 'module'

const run = async (): Promise<void> => {
  try {
    const cwd = process.env['GITHUB_WORKSPACE']
    if (!cwd) {
      throw new Error('No GITHUB_WORKSPACE')
    }

    // 1. Establish the base directory safely
    let baseDir = cwd || process.env.GITHUB_WORKSPACE || process.cwd()

    // 2. Fix the duplication: If the path already ends with '.github/classroom', back out to the root
    if (baseDir.includes('.github/classroom')) {
      baseDir = baseDir.split('.github/classroom')[0]
    }

    // 3. Resolve cleanly to a absolute path
    const jsonPath = path.resolve(baseDir, '.github/classroom/autograding.json')

    // 4. Convert to URL for your working ESM import strategy
    const fileUrl = pathToFileURL(jsonPath).href

    // 5. Run your successful dynamic import
    let data
    try {
      const module = await import(fileUrl, {with: {type: 'json'}})
      data = module.default
    } catch {
      const module = await import(fileUrl, {with: {type: 'json'}})
      data = module.default
    }
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
