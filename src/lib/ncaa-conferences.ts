import { power4ConferenceMap } from './power-4-teams';

/**
 * Finds the conference for a given team name using the Power 4 teams list.
 * @param teamName The name of the team from the API (expected to be an ESPN display name).
 * @returns The conference name as a string, or undefined if not found.
 */
export function getConference(teamName: string): string | undefined {
  return power4ConferenceMap.get(teamName);
}
