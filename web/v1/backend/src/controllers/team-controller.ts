import {Request, Response} from 'express';
import * as HttpStatus from 'http-status-codes';
import {MongoDb} from '../db';
import {DataReturnDTO, DataValidDTO, League, Team} from '../models';
import {IController} from './controller.interface';
import {LeagueController} from './league-controller';
import {RequestValidation} from './validation';

export class TeamController implements IController {
    public static table: string = 'team';

    public async delete(req: Request, res: Response) {
        if (!req.query.id || req.query.id.length !== MongoDb.MONGO_ID_LEN) {
            res.statusCode = HttpStatus.BAD_REQUEST;
            res.json({error: 'Id must be specified as a param of this request'});
            return;
        }
        const team: Team = (await MongoDb.getById(TeamController.table, req.query.id)).data;
        if (!team) {
            res.statusCode = HttpStatus.NOT_FOUND;
            res.json({error: 'You cannot delete a team that does not exist'});
            return;
        }
        await Team.delete(req.query.id);
        const league: League = (await MongoDb.getById(LeagueController.table, team.League)).data;
        // Remove Team from league when deleted, if league still exists
        if (league) {
            let index = -1;
            for (let i = 0; i < league.Teams.length; i++) {
                if (JSON.stringify(league.Teams[i]) === JSON.stringify(req.query.id)) {
                    index = i;
                }
            }
            // Remove league from league list if it is in there
            if (index > -1 && index < league.Teams.length) {
                league.Teams.splice(index, 1);
            }
        }
        await MongoDb.updateById(LeagueController.table, team.League, league);
        if (await MongoDb.deleteById(TeamController.table, req.query.id)) {
            res.statusCode = HttpStatus.OK;
            res.json({Msg: 'Successfully Deleted team with id ' + req.query.id});
            return;
        } else {
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.json({error: 'Internal Server Error delete failed'});
            return;
        }
    }

    public async get(req: Request, res: Response) {
        let out: DataReturnDTO;
        if (req.query.id) {
            if (req.query.id.length === MongoDb.MONGO_ID_LEN) { // Retrieve team by id
                out = await MongoDb.getById(TeamController.table, req.query.id);
            } else {
                res.statusCode = HttpStatus.BAD_REQUEST;
                res.json({error: 'The specified id is malformed'});
                return;
            }
        } else if (req.query.name) {
            if (req.query.name.length > 0) { // Retrieve team by name
                out = await MongoDb.getByName(TeamController.table, req.query.name);
            } else {
                res.statusCode = HttpStatus.BAD_REQUEST;
                res.json({error: 'The name specified is invalid'});
                return;
            }
        } else {
            res.statusCode = HttpStatus.BAD_REQUEST;
            res.json({error: 'A Name or Id must be specified for this request'});
            return;
        }

        if (out.valid) {
            if (out.data) {
                res.statusCode = HttpStatus.OK;
                res.json(out.data);
                return;
            } else {
                res.statusCode = HttpStatus.NOT_FOUND;
                res.json([]);
                return;
            }
        } else {
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.json(out.data);
            return;
        }
    }

    public async getAll(req: Request, res: Response) {
        const out = await MongoDb.getAll(TeamController.table);
        if (out.valid) {
            res.statusCode = HttpStatus.OK;
            res.json(out.data);
            return;
        } else {
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.json(out.data);
            return;
        }
    }

    public async post(req: Request, res: Response) {
        const isTeamValid = await Team.validate(req);
        if (!isTeamValid.valid) {
            res.statusCode = HttpStatus.BAD_REQUEST;
            res.json({error: isTeamValid.error});
            return;
        }
        const team: Team = new Team(req.body.Roster, req.body.Owner, req.body.Name, req.body.Description, req.body.League);

        // Get the league that owns this team
        const leagueTable = LeagueController.table;
        const leagueId = req.body.League;
        const leagueData: DataReturnDTO = await MongoDb.getById(leagueTable, leagueId);

        // Ensure that there is a league found.
        if (!leagueData.valid) {
            res.statusCode = HttpStatus.NOT_FOUND;
            res.json({error: 'Could not find team with id ' + leagueId});
            return;
        }

        if (!leagueData.data) {
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.json({error: 'Internal Server Error creation failed'});
            return;
        }

        if (await MongoDb.save(TeamController.table, team)) {
            // Add the team to the list of teams.
            const teamList: string[] = leagueData.data.Teams ? leagueData.data.Teams : [];
            teamList.push(team._id);

            if (await MongoDb.updateById(leagueTable, leagueId, {Teams: teamList})) {
                res.statusCode = HttpStatus.OK;
                res.json(team);
                return;
            } else {
                res.statusCode = HttpStatus.NOT_FOUND;
                res.json({error: 'Unable to find league which this team should belong to.'});
                return;
            }
        } else {
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.json({error: 'Internal Server Error creation failed'});
            return;
        }
    }

    public async put(req: Request, res: Response) {
        if (!await RequestValidation.RecordExistsWithBody(req, res, TeamController.table)) {
            return;
        }
        const isValidTeam: DataValidDTO = await Team.validateUpdate(req);
        if (!isValidTeam.valid) {
            res.statusCode = HttpStatus.BAD_REQUEST;
            res.json({error: isValidTeam.error});
            return;
        }
        if (!req.query.id || req.query.id.length !== MongoDb.MONGO_ID_LEN) {
            res.statusCode = HttpStatus.BAD_REQUEST;
            res.json({error: 'The id in this request is not valid'});
            return;
        }
        if ((await MongoDb.getById(TeamController.table, req.query.id)).data === null) {
            res.statusCode = HttpStatus.NOT_FOUND;
            res.json({error: 'You cannot update a team that does not exist'});
            return;
        }
        if (await MongoDb.updateById(TeamController.table, req.query.id, req.body)) {
            res.statusCode = HttpStatus.OK;
            res.json((await MongoDb.getById(TeamController.table, req.query.id)).data);
            return;
        } else {
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.json({error: 'Internal Server Error update failed'});
            return;
        }
    }
}
