// Seasons entity aggregates all of the hourly/daily snapshots

import { Season } from "../../generated/schema";

export function loadOrCreateSeason(seasonNumber: u32): Season {
  let season = Season.load(seasonNumber.toString());
  if (season == null) {
    season = new Season(seasonNumber.toString());
    season.save();
  }
  return season as Season;
}
