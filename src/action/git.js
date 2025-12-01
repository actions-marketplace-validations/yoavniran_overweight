import core from "@actions/core";
import github from "@actions/github";

/**
 * Ensure a branch exists, creating it from the base branch if needed
 * @param {Object} params
 * @param {Object} params.octokit - GitHub Octokit instance (unused but kept for API compatibility)
 * @param {string} params.branchName - The branch name to ensure exists
 * @param {string} params.baseBranch - The base branch to create from
 * @returns {Promise<boolean>} True if branch already existed, false if it was created
 */
const MAX_VERIFICATION_ATTEMPTS = 7;
const VERIFICATION_BASE_DELAY_MS = 500;

export const ensureUpdateBranchExists = async ({ octokit, branchName, baseBranch }) => {
  if (!octokit) {
    throw new Error("ensureUpdateBranchExists requires an authenticated octokit client.");
  }

  const { owner, repo } = github.context.repo;
  const branchRef = `heads/${branchName}`;
  const baseRef = `heads/${baseBranch}`;

  core.info(`Checking if branch ${branchName} exists via GitHub API...`);
  try {
    const existing = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: branchRef
    });
    const branchSha = existing.data.object?.sha || existing.data.sha;
    core.info(`Branch ${branchName} already exists at SHA: ${branchSha}`);
    return true;
  } catch (error) {
    if (error.status !== 404) {
      core.warning(
        `Failed to check branch ${branchName} existence via GitHub API: ${error.message}`
      );
      throw error;
    }
    core.info(`Branch ${branchName} does not exist (404), will create it from ${baseBranch}`);
  }

  core.info(`Fetching base branch ${baseBranch} via GitHub API...`);
  const base = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: baseRef
  });
  const baseSha = base.data.object?.sha || base.data.sha;
  core.info(`Base branch ${baseBranch} SHA: ${baseSha}`);

  try {
    core.info(`Creating branch ${branchName} from ${baseBranch} via GitHub API...`);
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });
    core.info(`Successfully created branch ${branchName}`);
  } catch (error) {
    if (error.status === 422) {
      core.info(
        `Branch ${branchName} already exists (422), will reuse existing branch after verification...`
      );
    } else {
      core.warning(
        `Failed to create branch ${branchName} via GitHub API: ${error.message} (status: ${error.status})`
      );
      throw error;
    }
  }

  // Verify the branch is accessible by retrying getRef with exponential backoff
  core.info(`Verifying branch ${branchName} is accessible via GitHub API...`);
  for (let attempt = 0; attempt < MAX_VERIFICATION_ATTEMPTS; attempt++) {
    try {
      const branchRefData = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: branchRef
      });
      const branchSha = branchRefData.data.object?.sha || branchRefData.data.sha;
      core.info(`Branch ${branchName} verified at SHA: ${branchSha}`);
      return true;
    } catch (error) {
      if (error.status === 404) {
        if (attempt < MAX_VERIFICATION_ATTEMPTS - 1) {
          const delay = VERIFICATION_BASE_DELAY_MS * Math.pow(2, attempt);
          core.info(
            `Branch ${branchName} not yet accessible (404), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_VERIFICATION_ATTEMPTS})...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          core.warning(
            `Branch ${branchName} still not accessible after ${MAX_VERIFICATION_ATTEMPTS} attempts via GitHub API`
          );
          throw new Error(
            `Branch ${branchName} was created but is not accessible after multiple retries`
          );
        }
      } else {
        throw error;
      }
    }
  }

  return true;
};

