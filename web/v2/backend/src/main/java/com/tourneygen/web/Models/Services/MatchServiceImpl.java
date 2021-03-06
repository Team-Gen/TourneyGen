package com.tourneygen.web.Models.Services;

import com.tourneygen.web.Models.DTOs.MatchDTO;
import com.tourneygen.web.Models.DTOs.MatchReportDTO;
import com.tourneygen.web.Models.Match;
import com.tourneygen.web.Models.Repositories.LeagueRepository;
import com.tourneygen.web.Models.Repositories.MatchRepository;
import com.tourneygen.web.Models.Repositories.TeamRepository;
import com.tourneygen.web.Models.Team;
import java.util.Collections;
import java.util.List;
import javax.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class MatchServiceImpl implements MatchService {

  private MatchRepository matchRepository;
  private LeagueRepository leagueRepository;
  private TeamRepository teamRepository;
  private EloService eloService;

  @Autowired
  public MatchServiceImpl(
      MatchRepository matchRepository,
      LeagueRepository leagueRepository,
      TeamRepository teamRepository,
      EloService eloService) {
    this.leagueRepository = leagueRepository;
    this.matchRepository = matchRepository;
    this.teamRepository = teamRepository;
    this.eloService = eloService;
  }

  @Override
  public MatchDTO create(MatchDTO matchDTO) {
    if (matchDTO.getHomeId().equals(matchDTO.getAwayId())) {
      throw new IllegalArgumentException("A team cannot play itself");
    }
    Match match = new Match();
    match.create(matchDTO, leagueRepository, teamRepository);
    match = matchRepository.save(match);
    matchDTO.setId(match.getId());
    return matchDTO;
  }

  @Override
  public List<MatchDTO> findMatch(long id) {
    return id < 0
        ? MatchDTO.findAll(matchRepository.findAll())
        : Collections.singletonList(
            new MatchDTO(
                matchRepository
                    .findById(id)
                    .orElseThrow(
                        () ->
                            new EntityNotFoundException(
                                "Match with id " + id + " was not found"))));
  }

  @Override
  public void deleteMatch(long id) {}

  @Override
  public MatchReportDTO reportMatch(MatchReportDTO reportDTO) throws MatchConflictException {
    Match match =
        matchRepository
            .findById(reportDTO.getMatchId())
            .orElseThrow(
                () ->
                    new EntityNotFoundException(
                        "Match with id " + reportDTO.getMatchId() + " was not found"));
    Team victor =
        teamRepository
            .findById(reportDTO.getVictorId())
            .orElseThrow(
                () ->
                    new EntityNotFoundException(
                        "Team with id " + reportDTO.getVictorId() + " was not found"));

    Team loser =
        teamRepository
            .findById(reportDTO.getLoserId())
            .orElseThrow(
                () ->
                    new EntityNotFoundException(
                        "Team with id " + reportDTO.getLoserId() + " was not found"));

    if (!reportDTO.getVictorId().equals(match.getHomeTeam().getId())
        && !reportDTO.getVictorId().equals(match.getAwayTeam().getId())) {
      throw new IllegalArgumentException(
          "The reported victor was not part of match " + match.getId());
    }
    if (!reportDTO.getLoserId().equals(match.getHomeTeam().getId())
        && !reportDTO.getLoserId().equals(match.getAwayTeam().getId())) {
      throw new IllegalArgumentException(
          "The reported loser was not part of match " + match.getId());
    }

    switch (match.getStatus()) {
      case "In_Progress":
        initialReport(match, victor, loser, reportDTO);
        return reportDTO;
      case "Pending_Report":
        completionReport(match, victor, loser, reportDTO);
        break;
      case "In_Conflict":
        throw new IllegalArgumentException(
            "Match " + match.getId() + " can only be updated by the league owner due to conflict");
      default:
        throw new IllegalArgumentException(
            "A match with status " + match.getStatus() + " cannot be updated");
    }
    return reportDTO;
  }

  @Override
  public MatchReportDTO resolveConflict(MatchReportDTO reportDTO) {
    Match match =
        matchRepository
            .findById(reportDTO.getMatchId())
            .orElseThrow(
                () ->
                    new EntityNotFoundException(
                        "Match with id " + reportDTO.getMatchId() + " was not found"));
    Team victor =
        teamRepository
            .findById(reportDTO.getVictorId())
            .orElseThrow(
                () ->
                    new EntityNotFoundException(
                        "Team with id " + reportDTO.getVictorId() + " was not found"));

    Team loser =
        teamRepository
            .findById(reportDTO.getLoserId())
            .orElseThrow(
                () ->
                    new EntityNotFoundException(
                        "Team with id " + reportDTO.getLoserId() + " was not found"));

    if (!reportDTO.getUpDatedBy().equals(match.getLeague().getOwner().getId())) {
      throw new IllegalArgumentException("Only the league owner can resolve a conflict");
    }
    if (!match.getStatus().equals("In_Conflict")) {
      throw new IllegalArgumentException(
          "This match is not in a conflict that needs to be resolved");
    }

    match.setVictor(victor);
    match.setLoser(loser);
    match.setHomeScore(reportDTO.getHomeScore());
    match.setAwayScore(reportDTO.getAwayScore());

    updateTeamStats(victor, loser);

    match.setStatus("Completed");
    reportDTO.setStatus("Completed");
    matchRepository.save(match);
    return reportDTO;
  }

  private void completionReport(Match match, Team victor, Team loser, MatchReportDTO reportDTO)
      throws MatchConflictException {

    if (match.getUpdatedBy().equals(reportDTO.getUpDatedBy())) {
      throw new MatchConflictException(
          "This teams has already posted to this match please wait for the other team to update");
    }

    // This only needs to check one side as the prior check handles the other case
    if (!match.getVictor().getId().equals(reportDTO.getVictorId())) {
      match.setStatus("In_Conflict");
      matchRepository.save(match);
      // TODO Add to exception handler
      throw new MatchConflictException("The team status assignments are conflicted");
    }
    if (match.getHomeScore() != reportDTO.getHomeScore()
        || match.getAwayScore() != reportDTO.getAwayScore()) {
      match.setStatus("In_Conflict");
      matchRepository.save(match);
      throw new MatchConflictException("The reported and stored scores are conflicted");
    }

    updateTeamStats(victor, loser);

    match.setStatus("Completed");
    reportDTO.setStatus("Completed");
    matchRepository.save(match);
  }

  private void initialReport(Match match, Team victor, Team loser, MatchReportDTO reportDTO) {
    match.setVictor(victor);
    match.setLoser(loser);
    match.setHomeScore(reportDTO.getHomeScore());
    match.setAwayScore(reportDTO.getAwayScore());
    match.setStatus("Pending_Report");
    match.setUpdatedBy(reportDTO.getUpDatedBy());
    matchRepository.save(match);
    reportDTO.setStatus("Pending_Report");
  }

  private void updateTeamStats(Team victor, Team loser) {
    // Update match counts
    victor.setWins(victor.getWins() + 1);
    loser.setLosses(victor.getLosses() + 1);

    eloService.updateElos(victor, loser);
    teamRepository.save(victor);
    teamRepository.save(loser);
  }
}
