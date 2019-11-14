import * as HttpStatus from 'http-status-codes';
import * as mongoUnit from 'mongo-unit';
import {App} from '../../../../web/backend/src/app';
import {MongoDb} from '../../../../web/backend/src/db';

// No ec6 import exists for these packages import must be done this way
// tslint:disable-next-line:no-var-requires
const chai = require('chai');
// tslint:disable-next-line:no-var-requires
const chaiHttp = require('chai-http');

// Set up the tests for http requests
chai.use(chaiHttp);
chai.should();

describe('Match Controller', async function() {
    let userId: string = '';
    let homeId: string = '';
    let awayId: string = '';
    let matchId: string = '';
    let serve; // A variable for the node app
    let conn; // The variable for the connection to the server
    const TIME_OUT: number = 20000;
    const MATCH_ROOT = '/api/match';
    this.timeout(TIME_OUT);

    before(async () => {
        serve = new App();
        conn = await serve.express.listen();
        process.env.DB_CONNECTION_STRING = await mongoUnit.start();
    });

    before(async () => {
        // Create an owner for the teams
        let res = await chai.request(conn)
            .post('/api/user')
            .send({
                displayName: 'eetar2',
                email: 'a@b.ca',
            });
        res.status.should.equal(HttpStatus.OK);
        userId = res.body._id;
        userId.length.should.equal(MongoDb.MONGO_ID_LEN);

        // Create a home team
        res = await chai.request(conn)
            .post('/api/team')
            .send({
                Description: 'yes',
                Name: 'bois',
                Owner: userId,
                Roster: ['Ethan'],
            });
        res.status.should.equal(HttpStatus.OK);
        homeId = res.body._id;
        // Create a away team
        res = await chai.request(conn)
            .post('/api/team')
            .send({
                Description: 'yes',
                Name: 'bois2',
                Owner: userId,
                Roster: ['Ethan'],
            });
        res.status.should.equal(HttpStatus.OK);
        awayId = res.body._id;

    });

    after(async () => {
        await mongoUnit.drop();
        await mongoUnit.stop();
    });

    it('it should Create a Match object', async () => {
        const match = {Home: homeId, Away: awayId};
        const res = await chai.request(conn)
            .post(MATCH_ROOT)
            .send(match);
        res.status.should.equal(HttpStatus.OK);
        res.body.should.be.a('object');
        matchId = res.body._id;

    });

    it('it should fail on no home id', async () => {
        const match = {Away: awayId};
        const res = await chai.request(conn)
            .post(MATCH_ROOT)
            .send(match);
        res.status.should.equal(HttpStatus.BAD_REQUEST);
        res.body.should.be.a('object');

    });

    it('it should fail no away id', async () => {
        const match = {Home: homeId};
        const res = await chai.request(conn)
            .post(MATCH_ROOT)
            .send(match);
        res.status.should.equal(HttpStatus.BAD_REQUEST);
        res.body.should.be.a('object');

    });

    it('it should get all Match object', async () => {
        const res = await chai.request(conn)
            .get(MATCH_ROOT + '/all');
        res.status.should.equal(HttpStatus.OK);
        res.body.length.should.equal(1);

    });

    it('it should get a Match object', async () => {
        const res = await chai.request(conn)
            .get(MATCH_ROOT)
            .query({id: matchId});
        res.status.should.equal(HttpStatus.OK);
        res.body.should.be.a('object');

    });

    it('it should fail to get a Match object no id', async () => {
        const res = await chai.request(conn)
            .get(MATCH_ROOT);
        res.status.should.equal(HttpStatus.BAD_REQUEST);
        res.body.should.be.a('object');

    });

    it('it should Report a match', async () => {
        const result = {Victor: homeId, Loser: awayId, Away_Score: 420, Home_Score: 69, Updated_By: homeId};
        const res = await chai.request(conn)
            .put(MATCH_ROOT + '/report')
            .send(result)
            .query({id: matchId});
        res.status.should.equal(HttpStatus.OK);
        res.body.should.be.a('object');

    });

    it('it should confirm a match', async () => {
        const result = {Victor: homeId, Loser: awayId, Away_Score: 420, Home_Score: 69, Updated_By: awayId};
        const res = await chai.request(conn)
            .put(MATCH_ROOT + '/report')
            .send(result)
            .query({id: matchId});
        res.status.should.equal(HttpStatus.OK);
        res.body.should.be.a('object');
        res.body.Msg.should.equal('This match has been confirmed by both teams');

    });

    it('it should fail to delete a Match object', async () => {
        const res = await chai.request(conn)
            .delete(MATCH_ROOT);
        res.status.should.equal(HttpStatus.BAD_REQUEST);
        res.body.should.be.a('object');

    });

    it('it should delete a Match object', async () => {
        const res = await chai.request(conn)
            .delete(MATCH_ROOT)
            .query({id: matchId});
        res.status.should.equal(HttpStatus.OK);
        res.body.should.be.a('object');

    });

});