/**
 * Simulated release steps for the Jenkins `main` pipeline.
 *
 * Nothing here deploys anything. This repository owns no SIT, UAT or production
 * environment; every "deployment" is an evidence record for a lab simulation.
 * Each record carries the Jenkins build number and commit, and records from any
 * other build are ignored, so stale workspace files can never validate a release.
 *
 * Usage: node ci/release.mts <authorization|manifest|sit-deploy|sit-smoke-result <exitCode>|uat-promote|evidence>
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EVIDENCE_DIR = 'release-evidence';
const FILES = {
  authorization: 'authorization.json',
  candidate: 'release-candidate.tar.gz',
  manifest: 'release-manifest.json',
  sitDeployment: 'sit-deployment.json',
  sitSmoke: 'sit-smoke.json',
  sitSmokePassed: 'sit-smoke.passed',
  uatPromotion: 'uat-promotion.json',
  evidence: 'release-evidence.json',
} as const;

const SIMULATION_NOTE =
  'Simulation only: no real deployment was performed and no SIT/UAT environment exists for this laboratory.';

interface BuildIdentity {
  repository: string;
  branch: string;
  commit: string;
  buildNumber: string;
  jobName: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

/** owner/name from the checkout URL; any embedded credentials are never read or written. */
function repositoryFromGitUrl(): string {
  try {
    const url = new URL(process.env.GIT_URL ?? '');
    return url.pathname.replace(/^\/+/, '').replace(/\.git$/, '') || 'unknown';
  } catch {
    return 'unknown';
  }
}

function identity(): BuildIdentity {
  return {
    repository: repositoryFromGitUrl(),
    branch: requiredEnv('BRANCH_NAME'),
    commit: requiredEnv('GIT_COMMIT'),
    buildNumber: requiredEnv('BUILD_NUMBER'),
    jobName: requiredEnv('JOB_NAME'),
  };
}

function evidencePath(file: string): string {
  return join(EVIDENCE_DIR, file);
}

function writeJson(file: string, data: object): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(evidencePath(file), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${evidencePath(file)}`);
}

/** Returns the record only if it exists, parses, and belongs to this build and commit. */
function readOwnRecord(file: string, id: BuildIdentity): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(evidencePath(file), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const record = parsed as Record<string, unknown>;
    return record.commit === id.commit && record.buildNumber === id.buildNumber ? record : undefined;
  } catch {
    return undefined;
  }
}

function requireApproved(id: BuildIdentity): void {
  const authorization = readOwnRecord(FILES.authorization, id);
  if (authorization?.status !== 'approved') {
    throw new Error('Deployment authorization for this build is not "approved"; refusing to continue.');
  }
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** First release step on every main build: resets the evidence folder and records the human decision. */
function recordAuthorization(): void {
  const id = identity();
  const status = process.env.AUTHORIZATION_STATUS;
  if (status !== 'approved' && status !== 'rejected') {
    throw new Error('AUTHORIZATION_STATUS must be "approved" or "rejected".');
  }
  rmSync(EVIDENCE_DIR, { recursive: true, force: true });
  writeJson(FILES.authorization, {
    ...id,
    status,
    submittedBy: process.env.AUTHORIZATION_SUBMITTER || null,
    recordedAt: new Date().toISOString(),
    meaning: 'A passing Main Sanity gate does not authorize deployment by itself; this is the separate human decision.',
  });
}

function writeManifest(): void {
  const id = identity();
  requireApproved(id);

  const candidate = evidencePath(FILES.candidate);
  if (!existsSync(candidate)) throw new Error(`Release candidate ${candidate} was not prepared.`);
  const playwright = JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8')) as {
    version: string;
  };

  const manifest = {
    schemaVersion: 1,
    ...id,
    authorizationStatus: 'approved',
    playwrightVersion: playwright.version,
    nodeVersion: process.version,
    ciImage: process.env.PLAYWRIGHT_IMAGE ?? 'unknown',
    releaseCandidate: { file: FILES.candidate, sha256: sha256(candidate), source: 'git archive of the built commit' },
    createdAt: new Date().toISOString(),
    deploymentMode: 'simulated',
    realDeploymentPerformed: false,
    note: SIMULATION_NOTE,
  };
  writeJson(FILES.manifest, manifest);

  const reread = readOwnRecord(FILES.manifest, id);
  if (
    reread?.deploymentMode !== 'simulated' ||
    reread.realDeploymentPerformed !== false ||
    reread.branch !== 'main' ||
    typeof reread.playwrightVersion !== 'string'
  ) {
    throw new Error('Release manifest failed validation.');
  }
  console.log('Release manifest validated.');
}

function recordSitDeployment(): void {
  const id = identity();
  requireApproved(id);
  const manifest = readOwnRecord(FILES.manifest, id);
  if (!manifest) throw new Error('No valid release manifest for this build; refusing simulated SIT deployment.');

  console.log('SIMULATED SIT DEPLOYMENT: nothing is deployed and no SIT environment is contacted.');
  writeJson(FILES.sitDeployment, {
    ...id,
    environment: 'SIT',
    deploymentMode: 'simulated',
    realDeploymentPerformed: false,
    releaseCandidateSha256: (manifest.releaseCandidate as { sha256?: unknown } | undefined)?.sha256 ?? null,
    performedAt: new Date().toISOString(),
    note: SIMULATION_NOTE,
  });
}

function recordSitSmokeResult(rawExitCode: string | undefined): void {
  const id = identity();
  const exitCode = Number(rawExitCode);
  if (!Number.isInteger(exitCode) || exitCode < 0) throw new Error('sit-smoke-result needs a numeric exit code.');

  rmSync(evidencePath(FILES.sitSmokePassed), { force: true });
  writeJson(FILES.sitSmoke, {
    ...id,
    suite: '@smoke',
    target: 'Public ServeRest reference services (not deployed by this pipeline)',
    exitCode,
    status: exitCode === 0 ? 'passed' : 'failed',
    finishedAt: new Date().toISOString(),
  });
  if (exitCode === 0) writeFileSync(evidencePath(FILES.sitSmokePassed), `${id.buildNumber} ${id.commit}\n`);
}

function recordUatPromotion(): void {
  const id = identity();
  requireApproved(id);
  if (!readOwnRecord(FILES.sitDeployment, id)) throw new Error('Simulated SIT deployment is missing for this build.');
  if (readOwnRecord(FILES.sitSmoke, id)?.status !== 'passed') throw new Error('SIT Smoke did not pass for this build.');

  console.log('SIMULATED UAT PROMOTION: nothing is deployed and no UAT environment is contacted. No second smoke run.');
  writeJson(FILES.uatPromotion, {
    ...id,
    environment: 'UAT',
    promotionMode: 'simulated',
    realDeploymentPerformed: false,
    basis: 'SIT Smoke result recorded earlier in this same build.',
    promotedAt: new Date().toISOString(),
    note: SIMULATION_NOTE,
  });
}

function writeReleaseEvidence(): void {
  const id = identity();
  const authorization = readOwnRecord(FILES.authorization, id);
  const sitDeployment = readOwnRecord(FILES.sitDeployment, id);
  const sitSmoke = readOwnRecord(FILES.sitSmoke, id);
  const uatPromotion = readOwnRecord(FILES.uatPromotion, id);

  // Main Sanity is fail-hard and runs before authorization, so this stage is only reachable after it passed.
  const mainSanity = 'passed';
  const authorizationStatus = typeof authorization?.status === 'string' ? authorization.status : 'unknown';
  const sitDeploymentStatus = sitDeployment ? 'performed' : 'not-performed';
  const sitSmokeStatus = typeof sitSmoke?.status === 'string' ? sitSmoke.status : 'not-run';
  const uatPromotionStatus = uatPromotion ? 'performed' : 'not-performed';

  const releaseValidated =
    authorizationStatus === 'approved' &&
    sitDeploymentStatus === 'performed' &&
    sitSmokeStatus === 'passed' &&
    uatPromotionStatus === 'performed';

  writeJson(FILES.evidence, {
    ...id,
    mainSanity,
    authorizationStatus,
    authorizationSubmittedBy: authorization?.submittedBy ?? null,
    simulatedSitDeployment: sitDeploymentStatus,
    sitSmoke: sitSmokeStatus,
    simulatedUatPromotion: uatPromotionStatus,
    releaseValidated,
    releaseValidatedMeaning:
      'true only when Main Sanity passed, deployment was approved, the simulated SIT deployment belongs to this build and commit, SIT Smoke passed and the simulated UAT promotion was recorded.',
    realDeploymentPerformed: false,
    generatedAt: new Date().toISOString(),
    note: SIMULATION_NOTE,
  });
  console.log(
    `RELEASE EVIDENCE: authorization=${authorizationStatus} sitDeployment=${sitDeploymentStatus} ` +
      `sitSmoke=${sitSmokeStatus} uatPromotion=${uatPromotionStatus} releaseValidated=${releaseValidated}`,
  );
}

const commands: Record<string, (argument?: string) => void> = {
  authorization: recordAuthorization,
  manifest: writeManifest,
  'sit-deploy': recordSitDeployment,
  'sit-smoke-result': recordSitSmokeResult,
  'uat-promote': recordUatPromotion,
  evidence: writeReleaseEvidence,
};

const [command = '', argument] = process.argv.slice(2);
try {
  const run = commands[command];
  if (!run) throw new Error(`Unknown command "${command}". Expected one of: ${Object.keys(commands).join(', ')}.`);
  run(argument);
} catch (error) {
  console.error(`release: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
