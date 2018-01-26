const MIN_ATTACKERS = 12;
const MIN_NEXUS = 4;
const MAX_DEFENDERS = 8;
const MAX_GLOBAL_DEFENDERS = 25;
const MAX_SENSORS = 5;
var currentEnemy;
var lastChangedEnemyTime;

// unit limit constant
function atLimits()
{
	return countDroid(DROID_ANY) > 299;
}

// random integer between 0 and max-1 (for convenience)
function random(max)
{
	return (max <= 0) ? 0 : Math.floor(Math.random() * max);
}

// Returns true if something is defined
function isDefined(data)
{
	return typeof(data) !== "undefined";
}

function log(message)
{
	dump(gameTime + " : " + message);
}

function logObj(obj, message)
{
	dump(gameTime + " [" + obj.name + " id=" + obj.id + "] > " + message);
}

function isHeli(droid)
{
	return droid.propulsion === "Helicopter";
}

// Make sure a unit does not try to go off map
function mapLimits(x, y, num1, num2, xOffset, yOffset)
{
	var coordinates = [];
	var xPos = x + xOffset + random(num1) - num2;
	var yPos = y + yOffset + random(num1) - num2;

	if (xPos < 2)
	{
		xPos = 2;
	}
	if (yPos < 2)
	{
		yPos = 2;
	}
	if (xPos >= mapWidth - 2)
	{
		xPos = mapWidth - 3;
	}
	if (yPos >= mapHeight - 2)
	{
		yPos = mapHeight - 3;
	}

	return {"x": xPos, "y": yPos};
}

//Return a closeby enemy object. Will be undefined if none.
function rangeStep(obj, visibility)
{
	const STEP = 1000;
	var target;

	for (var i = 0; i <= 30000; i += STEP)
	{
		var temp = enumRange(obj.x, obj.y, i, currentEnemy, visibility);
		if (isDefined(temp[0]))
		{
			target = temp[0];
			break;
		}
	}

	return target;
}

const derrick = "A0ResourceExtractor";
const factory = "A0BaBaFactory";
const vtolfac = "A0BaBaVtolFactory";
const gen = "A0BaBaPowerGenerator";
const oilres = "OilResource";
const repair = "ScavRepairCentre";
const vtolpad = "A0BaBaVtolPad";

const defenses = [
	"A0BaBaBunker",
	"A0BaBaBunker",
	"A0BaBaBunker",
	"A0CannonTower",
	"A0CannonTower",
	"A0CannonTower",
	"A0BaBaFlameTower",
	"A0BaBaFlameTower",
	"A0BaBaRocketPit",
	"A0BaBaRocketPit",
	"A0BaBaRocketPitAT",
	"A0BaBaMortarPit",
	"bbaatow",
];

const templates = [
	["B4body-sml-trike01","bTrikeMG"],
	["B4body-sml-trike01","bTrikeMG"],
	["B4body-sml-trike01","bTrikeMG"],
	["B4body-sml-trike01","bTrikeMG"],
	["B3body-sml-buggy01","BuggyMG"],
	["B3body-sml-buggy01","BuggyMG"],
	["B2JeepBody","BJeepMG"],
	["B2JeepBody","BJeepMG"],
	["B2JeepBody","BJeepMG"],
	["B3bodyRKbuggy01","BabaRocket"],
	["B3bodyRKbuggy01","BabaRocket"],
	["B2RKJeepBody","BabaRocket"],
	["B2RKJeepBody","BabaRocket"],
	["BusBody","BusCannon"],
	["BusBody","BusCannon"],
	["BusBody","BabaPitRocketAT"],
	["B2tractor","BabaFlame"],
	["B2tractor","BabaFlame"],
	["B2tractor","BabaFlame"],
	["FireBody","BabaFlame"],
	["FireBody","BabaFlame"],
	["FireBody","BusCannon"],
	["FireBody","BabaPitRocket"],
	["FireBody","BabaPitRocketAT"],
	["ScavCamperBody","BabaPitRocket"],
	["ScavCamperBody","BusCannon"],
	["ScavTruckBody","BabaFlame","BabaRocket","BabaPitRocketAT"],
	["ScavTruckBody","BusCannon","BabaPitRocket","BabaRocket"],
	["ScavIcevanBody","BabaFlame"],
	["ScavIcevanBody","Mortar1Mk1"],
	["ScavNEXUStrack","ScavNEXUSlink"],
	["ScavNEXUStrack","ScavNEXUSlink"],
	["ScavNEXUStrack","ScavNEXUSlink"],
];

const vtolTemplates = [
	["ScavengerChopper", "MG1-VTOL-SCAVS", "MG1-VTOL-SCAVS", "MG1-VTOL-SCAVS"],
	["HeavyChopper", "Rocket-VTOL-Pod-SCAVS"],
];

// scav groups
var globalDefendGroup; // tanks that defend all bases
var needToPickGroup; // a group
var baseInfo = [];
var helicoperAttackers;
var lifts;

function constructBaseInfo(x, y)
{
	this.x = x;
	this.y = y;
	this.defendGroup = newGroup(); // tanks to defend the base
	this.nexusGroup = newGroup(); // tanks to capture the enemy
	this.builderGroup = newGroup(); // trucks to build base structures and defenses
	this.attackGroup = newGroup(); // tanks to attack nearby things
}

function findNearest(list, x, y, flag)
{
	var minDist = Infinity, minIdx;
	for (var i = 0, l = list.length; i < l; ++i)
	{
		var d = distBetweenTwoPoints(list[i].x, list[i].y, x, y);
		if (d < minDist)
		{
			minDist = d;
			minIdx = i;
		}
	}
	return (flag === true) ? list[minIdx] : minIdx;
}

function reviseGroups()
{
	var list = enumGroup(needToPickGroup);
	for (var i = 0, l = list.length; i < l; ++i)
	{
		var droid = list[i];
		addDroidToSomeGroup(droid);
		var coords = mapLimits(droid.x, droid.y, 15, 7, 0, 0);
		orderDroidLoc(droid, DORDER_SCOUT, coords.x, coords.y);
	}
}

function addDroidToSomeGroup(droid)
{
	var base = findNearest(baseInfo, droid.x, droid.y, true);

	switch (droid.droidType)
	{
		case DROID_CONSTRUCT:
		{
			groupAddDroid(base.builderGroup, droid);
			break;
		}
		case DROID_WEAPON:
		{
			if (droid.name.indexOf("Nexus") > -1)
			{

				if (groupSize(base.nexusGroup) < (2 * MIN_NEXUS))
				{
					groupAddDroid(base.nexusGroup, droid);
				}
				else
				{
					var rBase = random(baseInfo.length);
					groupAddDroid(baseInfo[rBase].nexusGroup, droid);
				}
				break;
			}

			if (groupSize(base.defendGroup) < MAX_DEFENDERS)
			{
				groupAddDroid(base.defendGroup, droid);
			}

			if(groupSize(base.attackGroup) < MIN_ATTACKERS)
			{
				groupAddDroid(base.attackGroup, droid);
				break;
			}

			if (groupSize(globalDefendGroup) < MAX_GLOBAL_DEFENDERS)
			{
				groupAddDroid(globalDefendGroup, droid);
				break;
			}
			else
			{
				var rBase = random(baseInfo.length);
				groupAddDroid(baseInfo[rBase].attackGroup, droid);
			}
		}
		break;
		case DROID_SENSOR:
		{
			groupAddDroid(base.attackGroup, droid);
		}
		break;

		case DROID_PERSON:
		{
			groupAddDroid(base.defendGroup, droid);
		}
		break;
	}
}

function groupOfTank(droid)
{
	for (var i = 0, b = baseInfo.length; i < b; ++i)
	{
		if (droid.group === baseInfo[i].attackGroup)
		{
			return baseInfo[i].attackGroup;
		}

		if (droid.group === baseInfo[i].nexusGroup)
		{
			return baseInfo[i].nexusGroup;
		}
	}
}

function buildStructure(droid, stat)
{
	if (droid.order !== DORDER_BUILD && isStructureAvailable(stat, me))
	{
		var loc = pickStructLocation(droid, stat, droid.x, droid.y, 0);
		if (isDefined(loc) && orderDroidBuild(droid, DORDER_BUILD, stat, loc.x, loc.y))
		{
			return true;
		}
	}

	return false;
}

function buildTower(droid)
{
	return buildStructure(droid, defenses[random(defenses.length)]);
}

function establishBase(droid)
{
	var base = findNearest(baseInfo, droid.x, droid.y, true);
	var dist = distBetweenTwoPoints(base.x, base.y, droid.x, droid.y);

	//dist makes sure that factories are not built too close to eachother
	if (dist > 8 && buildStructure(droid, factory))
	{
		var n = baseInfo.length;
		baseInfo[n] = new constructBaseInfo(droid.x, droid.y);
		groupAddDroid(baseInfo[n].builderGroup, droid);
		return true;
	}
	return false;
}

function buildThingsWithDroid(droid)
{
	const MAX_FACTORY_COUNT = 30;

	switch (random(7))
	{
		case 0:
			if ((countStruct(factory) < MAX_FACTORY_COUNT) && ((5 * countStruct(factory)) < countStruct(derrick)) || (playerPower(me) > 500))
			{
				establishBase(droid);
			}
		break;
		case 1:
			if ((countStruct(derrick) - (countStruct(gen) * 4)) > 0)
			{
				buildStructure(droid, gen);
			}
		break;
		case 2:
			if ((4*countStruct(vtolfac)) < countStruct(factory) && (gameTime > 150000))
			{
				buildStructure(droid, vtolfac);
			}
		break;
		case 3:
			var result = findNearest(enumFeature(-1, oilres), droid.x, droid.y, true);
			if (isDefined(result))
			{
				orderDroidBuild(droid, DORDER_BUILD, derrick, result.x, result.y);
			}
		break;
		case 4:
			if ((playerPower(me) > 60) && (countStruct(repair) < 5) && (gameTime > 200000))
			{
				buildStructure(droid, repair);
			}
		break;
		case 5:
			if (countHelicopters() > 2 * countStruct(vtolpad))
			{
				buildStructure(droid, vtolpad);
			}
		break;
		default:
			if (playerPower(me) > 150)
			{
				buildTower(droid);
			}
		break;
	}
}

function buildThings()
{
	var list = enumDroid(me, DROID_CONSTRUCT).filter(function(dr) {
		return (dr.order !== DORDER_BUILD);
	});

	for (var i = 0, d = list.length; i < d; ++i)
	{
		var droid = list[i];
		if (droid.order !== DORDER_RTR)
		{
			//Build a defense at an enemy derrick
			for (var q = 0; q < maxPlayers; ++q)
			{
				var dlist = enumStruct(q, derrick);
				for (var r = 0, l = dlist.length; r < l; ++r)
				{
					var enemy_derrick = dlist[r];
					if (distBetweenTwoPoints(droid.x, droid.y, enemy_derrick.x, enemy_derrick.y) < 3)
					{
						buildTower(droid);
					}
				}
			}
			buildThingsWithDroid(droid);
		}
	}
}

function scavBuildDroid(fac, name, body, prop, weapon)
{
	var success = false;

	if (isDefined(weapon[2]))
	{
		success = buildDroid(fac, name, body, prop, "", "", weapon[0], weapon[1], weapon[2]);
	}
	else if (isDefined(weapon[1]))
	{
		success = buildDroid(fac, name, body, prop, "", "", weapon[0], weapon[1]);
	}
	else
	{
		success = buildDroid(fac, name, body, prop, "", "", weapon[0]);
	}

	return success;
}

function produceCrane(fac)
{
	if (countDroid(DROID_CONSTRUCT, me) > 15)
	{
		return false;
	}

	const CRANE_BODY = "B2crane";
	const CRANE_WEAP = "scavCrane";
	var num = random(2) + 1; // Choose crane 1 or 2.

	return buildDroid(fac, "Crane", CRANE_BODY + num, "BaBaProp", "", "", CRANE_WEAP + num);
}

function produceDroid(fac)
{
	if (countDroid(DROID_CONSTRUCT, me) < 15 || !random(10))
	{
		if (gameTime < 300000)
		{
			produceCrane(fac);
			return;
		}
		else if (countDroid(DROID_CONSTRUCT, me) < 3)
		{
			produceCrane(fac);
			return;
		}
	}

	var weapons = [];
	if (!random(10))
	{
		if (countDroid(DROID_SENSOR, me) < MAX_SENSORS)
		{
			weapons.push("ScavSensor");
			scavBuildDroid(fac, "Sensor", "BusBody", "BaBaProp", weapons);
		}
	}
	else
	{
		var j = random(templates.length);
		var name = (templates[j][1].indexOf("NEXUS") > -1) ? "Nexus Tank" : "Scavenger unit";

		for (var x = 1; x < 4; ++x)
		{
			if (isDefined(templates[j][x]))
			{
				weapons.push(templates[j][x]);
			}
			else
			{
				break;
			}
		}

		scavBuildDroid(fac, name, templates[j][0], "BaBaProp", weapons);
	}
}

function produceHelicopter(fac)
{
	var j = random(vtolTemplates.length);
	var weapons = [];

	for (var x = 1; x < 4; ++x)
	{
		if (isDefined(vtolTemplates[j][x]))
		{
			weapons.push(vtolTemplates[j][x]);
		}
		else
		{
			break;
		}
	}
	scavBuildDroid(fac, "ScavengerHelicopter", vtolTemplates[j][0], "Helicopter", weapons);
}

function structureReady(struct)
{
	return (structureIdle(struct) && struct.status === BUILT);
}

function produceThings()
{
	if (atLimits())
	{
		return;
	}

	var list = enumStruct(me, factory);
	for (var i = 0, f = list.length; i < f; ++i)
	{
		var fac = list[i];

		if (structureReady(fac))
		{
			produceDroid(fac);
		}
	}

	list = enumStruct(me, vtolfac);
	for (var i = 0, f = list.length; i < f; ++i)
	{
		var fac = list[i];

		if (structureReady(fac))
		{
			produceHelicopter(fac);
		}
	}
}

function attackWithDroid(droid, target, force)
{
	if (droid.order === DORDER_RTR)
	{
		return;
	}

	if (droid.droidType === DROID_WEAPON)
	{
		if ((droid.order !== DORDER_ATTACK) || force)
		{
			orderDroidObj(droid, DORDER_ATTACK, target);
		}
	}
	else if (droid.droidType === DROID_SENSOR)
	{
		if ((droid.order !== DORDER_OBSERVE) || force)
		{
			orderDroidObj(droid, DORDER_OBSERVE, target);
		}
	}
}

function helicopterArmed(obj)
{
	for (var i = 0; i < obj.weapons.length; ++i)
	{
		if (Math.floor(obj.weapons[i].armed) > 0)
		{
			return true;
		}
	}

	return false;
}

function helicopterReady(droid)
{
	if (droid.order === DORDER_ATTACK || droid.order === DORDER_REARM)
	{
		return false;
	}
	if (helicopterArmed(droid) && droid.health > 50)
	{
		return true;
	}
	if (droid.order !== DORDER_REARM)
	{
		orderDroid(droid, DORDER_REARM);
	}

	return false;
}

//Helicopters can only attack things that the scavengers have seen
function helicopterAttack()
{
	var list = findFreeHelicopters();
	if (!list.len)
	{
		return;
	}

	var target = rangeStep(baseInfo[random(baseInfo.length)], true);
	for (var i = 0, l = list.len; i < l; ++i)
	{
		var droid = list.copters[i];
		var coords = [];

		if (isDefined(target))
		{
			coords = mapLimits(target.x, target.y, 5, 2, 0, 0);
		}
		else
		{
			var xOff = random(2);
			var yOff = random(2);
			xOff = (!xOff) ? -random(10) : random(10);
			yOff = (!yOff) ? -random(10) : random(10);
			coords = mapLimits(droid.x, droid.y, 5, 2, xOff, yOff);
		}

		orderDroidLoc(droid, DORDER_SCOUT, coords.x, coords.y);
	}
}

//Ignores lifts
function countHelicopters()
{
	return groupSize(helicoperAttackers);
}

//ignores lifts
function findFreeHelicopters()
{
	var freeHelis = enumGroup(helicoperAttackers).filter(function(object) {
		return helicopterReady(object);
	});

	return {copters: freeHelis, len: freeHelis.length};
}

function groundAttackStuff()
{
	if (!baseInfo.length)
	{
		return;
	}
	if (random(100) < 20)
	{
		changeEnemy();
	}

	var target = rangeStep(baseInfo[random(baseInfo.length)], false);

	if (isDefined(target))
	{
		for (var i = 0, l = baseInfo.length; i < l; ++i)
		{
			var base = baseInfo[i];
			var attackDroids = enumGroup(base.attackGroup);
			if (isDefined(target) && attackDroids.length > MIN_ATTACKERS)
			{
				attackWithDroid(attackDroids[i], target, false);
			}
		}

		for (var i = 0, l = baseInfo.length; i < l; ++i)
		{
			var base = baseInfo[i];
			var nexusDroids = enumGroup(base.nexusGroup);
			if (isDefined(target) && nexusDroids.length > MIN_NEXUS)
			{
				attackWithDroid(nexusDroids[i], target, true);
			}
		}
	}
}

//Return all enemy players that are still alive. An optional argument can be
//passed to determine if that specific player is alive or not.
function getAliveEnemyPlayers(player)
{
	if (isDefined(player))
	{
		if ((countStruct("A0LightFactory", player) + countStruct("A0CyborgFactory", player) + countDroid(DROID_CONSTRUCT, player)) > 0)
		{
			return true;
		}

		return false;
	}

	var numEnemies = [];
	for (var i = 0; i < maxPlayers; i++)
	{
		if (!allianceExistsBetween(me, i) && i !== me)
		{
			//Are they alive (have factories and constructs)
			//Even if they still have attack droids, eventAttacked() will find them anyway if they do attack.
			if ((countStruct("A0LightFactory", i) + countStruct("A0CyborgFactory", i) + countDroid(DROID_CONSTRUCT, i)) > 0)
			{
				numEnemies.push(i); // count 'em, then kill 'em :)
			}
		}
	}

	return numEnemies;
}

function changeEnemy(player)
{
	if (lastChangedEnemyTime + 50000 > gameTime)
	{
		return;
	}

	if (!isDefined(player) || !getAliveEnemyPlayers(currentEnemy))
	{
		var living = getAliveEnemyPlayers();
		var num = living.length;
		if (!num)
		{
			currentEnemy = 0; //Just choose player 0 as a default.
			return;
		}
		var temp = living[random(num)];
		if (temp === currentEnemy)
		{
			return;
		}
		currentEnemy = temp;
		lastChangedEnemyTime = gameTime;
	}
	else if (isDefined(player) && currentEnemy !== player)
	{
		currentEnemy = player;
		lastChangedEnemyTime = gameTime;
	}
}

function eventAttacked(victim, attacker)
{
	// don't quarrel because of friendly splash damage
	if (attacker === null || victim.player !== me || attacker.player === me)
	{
		return;
	}

	changeEnemy(attacker.player);

	if (victim.type === STRUCTURE)
	{
		var base = findNearest(baseInfo, victim.x, victim.y, true);
		if (isDefined(base))
		{
			var list = enumGroup(base.defendGroup);

			//Let this base build more defense units then
			if (list.length < Math.floor(MAX_DEFENDERS / 2))
			{
				list = enumGroup(base.attackDroids);
			}

			list.concat(enumGroup(globalDefendGroup));
			for (var i = 0, l = list.length; i < l; ++i)
			{
				attackWithDroid(list[i], attacker, true);
			}
		}

	}
	else if (victim.type === DROID)
	{
		if (isHeli(victim))
		{
			return;
		}

		retreat(victim);

		var gr = groupOfTank(victim);
		if (isDefined(gr))
		{
			var list = enumGroup(gr);
			for (var i = 0, l = list.length; i < l; ++i)
			{
				attackWithDroid(list[i], attacker, true);
			}
		}
	}
}

function eventDroidBuilt(droid, fac)
{
	if (!isHeli(droid))
	{
		groupAddDroid(needToPickGroup, droid);
		queue("reviseGroups", 200);
	}
	else
	{
		if (droid.body !== "ChinookBody")
		{
			groupAddDroid(helicoperAttackers, droid);
		}
		else
		{
			groupAddDroid(lifts, droid);
		}
	}

	produceThings();
}

function eventStructureBuilt(structure, droid)
{
	if (structure.stattype === FACTORY)
	{
		if (!produceCrane(structure))
		{
			produceDroid(structure);
		}
	}
	else if (structure.stattype === VTOL_FACTORY)
	{
		produceHelicopter(structure);
	}
}

function eventGameInit()
{
	for (var i = 0; i < templates.length; ++i)
	{
		makeComponentAvailable(templates[i][0], me);
		makeComponentAvailable(templates[i][1], me);

		if (isDefined(templates[i][2]))
		{
			makeComponentAvailable(templates[i][2], me);
		}

		if (isDefined(templates[i][3]))
		{
			makeComponentAvailable(templates[i][3], me);
		}
	}

	for (var i = 0; i < vtolTemplates.length; ++i)
	{

		makeComponentAvailable(vtolTemplates[i][0], me);
		makeComponentAvailable(vtolTemplates[i][1], me);

		if (isDefined(vtolTemplates[i][2]))
		{
			makeComponentAvailable(vtolTemplates[i][2], me);
		}

		if (isDefined(vtolTemplates[i][3]))
		{
			makeComponentAvailable(vtolTemplates[i][3], me);
		}

	}

	const SCAV_COMPONENTS = [
		"B2crane1", "scavCrane1", "B2crane2", "scavCrane2", "ScavSensor",
		"BaBaProp", "Helicopter", "B2RKJeepBody", "B2tractor", "B3bodyRKbuggy01",
		"HeavyChopper", "ScavCamperBody", "ScavengerChopper", "ScavIcevanBody",
		"ScavNEXUSbody", "ScavNEXUStrack", "ScavTruckBody", "MG1-VTOL-SCAVS",
		"Rocket-VTOL-Pod-SCAVS", "ScavNEXUSlink", "BaBaCannon", "BabaPitRocket",
		"BabaPitRocketAT", "BabaRocket", "BTowerMG", "Mortar1Mk1", "BusCannon",
		"BabaFlame", "bTrikeMG", "BuggyMG", "BJeepMG", "ChinookBody",
	];

	for (var i = 0, c = SCAV_COMPONENTS.length; i < c; ++i)
	{
		makeComponentAvailable(SCAV_COMPONENTS[i], me);
	}

	enableStructure(factory, me);
	enableStructure(vtolfac, me);
	enableStructure(derrick, me);
	enableStructure(gen, me);
	enableStructure(repair, me);
	enableStructure(vtolpad, me);

	for (var i = 0, d = defenses.length; i < d; ++i)
	{
		enableStructure(defenses[i], me);
	}
}

// respond correctly on unit transfers
function eventObjectTransfer(object, from)
{
	if (object.type === DROID)
	{
		eventDroidBuilt(object, null);
	}
	else
	{
		eventStructureBuilt(object, null);
	}
}

function retreat(obj)
{
	if (isDefined(obj) && obj.type === DROID && obj.order !== DORDER_RTR)
	{
		if (!isHeli(obj) && obj.health < 75)
		{
			orderDroid(obj, DORDER_RTR);
		}
		return;
	}

	var list = enumDroid(me);
	for (var i = 0, l = list.length; i < l; ++i)
	{
		var droid = list[i];
		if (!random(4) && !isHeli(droid) && droid.order !== DORDER_RTR)
		{
			if (droid.health < 80)
			{
				orderDroid(droid, DORDER_RTR);
			}
		}
	}
}

function eventStartLevel()
{
	var list = enumStruct(me, factory);
	for (var i = 0, l = list.length; i < l; ++i)
	{
		var fac = list[i];
		baseInfo[i] = new constructBaseInfo(fac.x, fac.y);
	}
	currentEnemy = random(maxPlayers);
	lastChangedEnemyTime = 0;
	list = enumDroid(me);

	for (var i = 0, l = list.length; i < l; ++i)
	{
		addDroidToSomeGroup(list[i]);
	}

	globalDefendGroup = newGroup();
	needToPickGroup = newGroup();
	helicopterAttackers = newGroup();
	lifts = newGroup();

	produceThings();
	setTimer("retreat", 600);
	setTimer("produceThings", 900);
	setTimer("buildThings", 1200);
	setTimer("groundAttackStuff", 2000);
	setTimer("helicopterAttack", 3000);
}
