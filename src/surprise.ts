import { api } from "./api";

/** Opens a random letter. `?surprise=1` is what makes the letter view offer "Another" to keep wandering. */
export async function openRandomLetter(navigate: (to: string) => void, excludeId?: number): Promise<void> {
  try {
    const { id } = await api.randomLetter(excludeId);
    navigate(`/letters/${id}?surprise=1`);
  } catch {
    // Nothing to open (empty archive or a dropped request); staying put is the right outcome.
  }
}
