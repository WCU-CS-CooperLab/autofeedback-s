import { jest } from '@jest/globals'
import * as github from '@actions/github'
import { setCheckRunOutput } from '../output'

// ✅ Mock the entire module
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn<any>(),
  context: {
    repo: {
      owner: 'owner',
      repo: 'repo',
    },
  },
}))

// ✅ Strongly typed handle to the mock
const mockGetOctokit = (github as any).getOctokit as jest.Mock

describe('output', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updates check runs', async () => {
    const mockOctokit = {
      rest: {
        checks: {
          getWorkflowRun: jest.fn<any>().mockResolvedValue({
            data: {
              check_suite_url: 'https://api.github.com/check-suites/1',
            },
          }),

          listForSuite: jest.fn<any>().mockResolvedValue({
            data: {
              total_count: 1,
              check_runs: [{ id: 123 }],
            },
          }),

          update: jest.fn<any>().mockResolvedValue({}),
        },
      },
    }

    mockGetOctokit.mockReturnValue(mockOctokit)

    await  setCheckRunOutput('fake-token','test output', 'notice')

    expect(mockOctokit.rest.checks.update).toHaveBeenCalled()
  })
})
