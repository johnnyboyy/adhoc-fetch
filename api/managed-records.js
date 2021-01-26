import fetch from "../util/fetch-fill";
import URI from "urijs";

// /records endpoint
window.path = "http://localhost:3000/records";

// Your retrieve function plus any additional functions go here ...

// I think there's a bug in records/index.js line 530. If I send /records/?color=undefined
// it will pass the validations, but will not work in the filter function. It would filter
// out all the colors because it would be looking for the indexOf ${colorName} in "undefined"
// Maybe it should only allow the bottom-value undefined instead of the string "undefined"?

// Make this cleaner before submitting
const fetchRecords = async ({ page, colors }) => {
	try {
		const url = URI(window.path)
			.search({
				offset: 10 * (page - 1 || 0),
				"color[]": Array.isArray(colors) ? colors : undefined,
				limit: 10,
			})
			.toString();

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error("Bad Response");
		} else {
			return response.json();
		}
	} catch (error) {
		console.log({ error });

		return [];
	}
};

const isNextPage = async ({ page = null, colors, records }) => {
	// Edge case that there may be 10 results on the last page, but no pages after.
	// This little hack could save an extra API call each time, if that's not an issue.**
	// return records.length === 10

	// Better to go with the guarantee so that it all works properly
	try {
		const records = await fetchRecords({ page: page + 1, colors });

		return records.length > 0;
	} catch (error) {
		console.log({ error });
		return false;
	}
};
// ** Other solutions could be caching the pages so after some time you reduce the amount of calls to 0
//		You could also add the page information to the API response, based on the offest and limit provided.
//		That would remove the need to check for a next page existing.

const primaryCheck = (records = []) => {
	// This could be incorporated into the reducer that creates the metadata. It might be
	// slightly more performant too. The downside would be a more confusing reducer function,
	// and we would be doing two things in one function: mutating the records, AND generating
	// the metadata (ids, open, closedPrimaryCount)
	const primaryColors = ["red", "blue", "yellow"];

	return records.map((record) => {
		return { ...record, isPrimary: primaryColors.includes(record.color) };
	});
};

const breakdown = (records = []) => {
	// I do like making pure functions, but I think this one is a bit less clear than
	// the mutatingReducer below
	// const pureReducer = ({ ids, open, closedPrimaryCount }, record) => {
	// 	const closedPrimary = record.disposition === "closed" && record.isPrimary;

	// 	return {
	// 		ids: [...ids, record.id],
	// 		open: open.concat(record.disposition === "open" ? [record] : []),
	// 		closedPrimaryCount: closedPrimary ? closedPrimaryCount + 1 : closedPrimaryCount,
	// 	};
	// };

	const mutatingReducer = (metadata, record) => {
		const closedPrimary = record.disposition === "closed" && record.isPrimary;

		metadata.ids.push(record.id);

		if (record.disposition === "open") {
			metadata.open.push(record);
		}

		if (closedPrimary) {
			metadata.closedPrimaryCount += 1;
		}

		return metadata;
	};

	return records.reduce(mutatingReducer, { ids: [], open: [], closedPrimaryCount: 0 });
};

const retrieve = async ({ page = 1, colors } = { page: 1 }) => {
	try {
		const [records, hasNextPage] = await Promise.all([
			fetchRecords({ page, colors }),
			isNextPage({ page, colors }),
		]);

		// Does not NEED to be destructured, but I like that we can be explicit about
		// the structure of the data that gets returned. That way you don't have to go
		// looking through functions elsewhere to see what the shape of the data is
		// is going to look like
		const { ids, open, closedPrimaryCount } = breakdown(primaryCheck(records));

		return {
			previousPage: page - 1 || null,
			nextPage: hasNextPage ? page + 1 : null,
			ids,
			open,
			closedPrimaryCount,
		};
	} catch (error) {
		console.log({ error });

		return error;
	}
};

export default retrieve;
