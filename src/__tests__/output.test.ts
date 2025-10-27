import * as core from '@actions/core'
import {setCheckRunOutput} from '../output'
import nock from 'nock'

// Mock Octokit to prevent real API calls
jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      request: jest.fn().mockResolvedValue({}),
    })),
  }
})

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
})

afterEach(() => {
  expect(nock.isDone()).toBe(true)
  nock.cleanAll()
})

describe('output', () => {
  beforeEach(() => {
    nock('https://api.github.com').get('/repos/example/repository/actions/runs/98765')
      .reply(200, {
        check_suite_url: 'https://api.github.com/repos/example/repository/check-suites/111111',
      })
    nock('https://api.github.com', {
      reqheaders: {
        authorization: /Bearer .+/,
      },
    })
      .get('/repos/example/repository/check-suites/111111/check-runs?check_name=Autograding')
      .reply(200, {
        total_count: 1,
        check_runs: [
          {
            id: 222222,
          },
        ],
      })
  })

  it('matches included output', async () => {
    nock('https://api.github.com', {
      reqheaders: {
        authorization: /Bearer .+/,
      },
    })
      .patch('/repos/example/repository/check-runs/222222', (body) => {
        if (body.output?.text !== 'Dogs on parade') return false
        if (!body.output?.annotations || body.output.annotations[0]?.message !== 'Dogs on parade') return false
        return true
      })
      .reply(200, {})

    await expect(setCheckRunOutput('Dogs on parade', 'complete')).resolves.not.toThrow()
  }, 10000)
})
