import * as core from '@actions/core'
import * as github from '@actions/github'
import {setCheckRunOutput} from '../output'
import nock from 'nock'

beforeEach(() => {
  jest.resetModules()
  jest.restoreAllMocks()

  jest.spyOn(core, 'getInput').mockImplementation((name: string): string => {
    if (name === 'token') return '12345'
    return ''
  })

  jest.spyOn(core, 'setOutput').mockImplementation(() => {
    return
  })

  process.env['GITHUB_REPOSITORY'] = 'example/repository'
  process.env['GITHUB_RUN_ID'] = '98765'

  // Mock GitHub client
  const mockOctokit = {
    rest: {
      actions: {
        getWorkflowRun: jest.fn().mockResolvedValue({
          data: {
            check_suite_url: 'https://api.github.com/repos/example/repository/check-suites/111111',
          },
        }),
      },
      checks: {
        listForSuite: jest.fn().mockResolvedValue({
          data: {
            total_count: 1,
            check_runs: [{id: 222222}],
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    },
  }

  jest.spyOn(github, 'getOctokit').mockReturnValue(mockOctokit as any)
})

afterEach(() => {
  //expect(nock.isDone()).toBe(true)
  nock.cleanAll()
})

describe('output', () => {
  it('matches included output', async () => {
    nock('https://api.github.com')
      .patch('/repos/example/repository/check-runs/222222', (body) => {
        if (body.output?.text !== 'Dogs on parade') return false
        if (!body.output?.annotations || body.output.annotations[0]?.message !== 'Dogs on parade') return false
        return true
      })
      .reply(200, {})

    await expect(setCheckRunOutput('Dogs on parade', 'complete')).resolves.not.toThrow()
  }, 10000)
})
