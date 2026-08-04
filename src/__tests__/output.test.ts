import nock from 'nock'
import type {GitHub} from '@actions/github/lib/utils'
import {jest} from '@jest/globals'

// Declare mocks up front
const mockGetInput = jest.fn<(name: string) => string>()
const mockSetOutput = jest.fn()
const mockGetOctokit = jest.fn()

jest.unstable_mockModule('@actions/core', () => ({
  getInput: mockGetInput,
  setOutput: mockSetOutput,
}))

jest.unstable_mockModule('@actions/github', () => ({
  getOctokit: mockGetOctokit,
}))

// Import AFTER mocking, so setCheckRunOutput picks up the mocked modules
const {setCheckRunOutput} = await import('../output.js')

beforeEach(() => {
  jest.restoreAllMocks()

  mockGetInput.mockImplementation((name: string): string => {
    if (name === 'token') return '12345'
    return ''
  })

  mockSetOutput.mockImplementation(() => {
    return
  })

  process.env['GITHUB_REPOSITORY'] = 'example/repository'
  process.env['GITHUB_RUN_ID'] = '98765'

  const mockOctokit = {
    rest: {
      actions: {
        getWorkflowRun: jest.fn<() => Promise<{data: {check_suite_url: string}}>>().mockResolvedValue({
          data: {
            check_suite_url: 'https://api.github.com/repos/example/repository/check-suites/111111',
          },
        }),
      },
      checks: {
        listForSuite: jest
          .fn<
            () => Promise<{
              data: {total_count: number; check_runs: {id: number; name: string}[]}
            }>
          >()
          .mockResolvedValue({
            data: {
              total_count: 1,
              check_runs: [{id: 222222, name: 'grade / Autograding'}],
            },
          }),
        update: jest.fn<() => Promise<Record<string, never>>>().mockResolvedValue({}),
      },
    },
  }

  mockGetOctokit.mockReturnValue(mockOctokit as unknown as InstanceType<typeof GitHub>)
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
