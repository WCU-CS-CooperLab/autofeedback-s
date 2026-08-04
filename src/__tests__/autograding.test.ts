import path from 'path'
import {fileURLToPath} from 'url'
import {PushEvent} from '@octokit/webhooks-types'
import nock from 'nock'
import {jest} from '@jest/globals'

const fileName = fileURLToPath(import.meta.url)
const dirName = path.dirname(fileName)

// Declare mocks up front
const mockSetOutput = jest.fn()
const mockGetInput = jest.fn<(name: string) => string>()
const mockSetFailed = jest.fn<(message: string | Error) => void>()

const mockContext = {
  payload: {} as PushEvent,
}

jest.unstable_mockModule('@actions/core', () => ({
  setOutput: mockSetOutput,
  getInput: mockGetInput,
  setFailed: mockSetFailed,
}))

jest.unstable_mockModule('@actions/github', () => ({
  context: mockContext,
}))

// Import after mocking
const {default: run} = await import('../autograding.js')

beforeEach(() => {
  jest.restoreAllMocks()

  mockSetOutput.mockImplementation(() => {
    return
  })

  mockGetInput.mockImplementation((name: string): string => {
    if (name === 'token') return '12345'
    return ''
  })

  mockSetFailed.mockImplementation(() => {
    return
  })

  process.env['GITHUB_WORKSPACE'] = path.resolve(dirName, 'java')
  process.env['GITHUB_REPOSITORY'] = 'example/repository'

  mockContext.payload = {
    ref: 'refs/tags/simple-tag',
    before: '6113728f27ae82c7b1a177c8d03f9e96e0adf246',
    after: '0000000000000000000000000000000000000000',
    commits: [],
    repository: {
      id: 186853002,
      node_id: 'MDEwOlJlcG9zaXRvcnkxODY4NTMwMDI=',
      name: 'repository',
      full_name: 'example/repository',
      owner: {
        name: 'Codertocat',
        email: '21031067+Codertocat@users.noreply.github.com',
        login: 'Codertocat',
        id: 21031067,
        type: 'User',
        html_url: '',
        url: '',
      },
      html_url: '',
      description: null,
      fork: false,
      url: '',
    },
  } as unknown as PushEvent
})

afterEach(() => {
  expect(nock.pendingMocks()).toEqual([])
  nock.isDone()
  nock.cleanAll()
})

describe('autograding action', () => {
  it('runs', async () => {
    await expect(run()).resolves.not.toThrow()
  }, 10000)
})
