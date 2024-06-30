import clicksTrackingModel from '@/models/clicksTrackingModel';
import linksListModel from '@/models/linksListModel';
import websiteStatsModel from '@/models/websiteStatsModel';
import { getMonthNumber, getWeekNumber, getYearNumber } from '@/utils/DateFunctions';
import { FetchUserIP } from '@/utils/FetchUserIP';
import axios from 'axios';
import { connect2MongoDB } from 'connect2mongodb';
import { NextResponse, type NextRequest, userAgent } from 'next/server';
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
    try {

        //! Fetching headers for verification
        const headersList = headers();
        const referrerSite = headersList.get('referrerSite');

        //! Getting user browser details
        const { browser, os, device, isBot } = userAgent(request)

        //! Get alias value from URL
        const searchParams = request.nextUrl.searchParams;
        const alias = searchParams.get('alias');

        //! Connecting to MongoDB
        await connect2MongoDB();

        //! Get link data from alias
        const aliasData = await linksListModel.findOne({ alias }).select('userName destinationURL status toSupport isApp');

        //! If link not found, then, return to homepage
        if (!aliasData) { return NextResponse.json({ message: "Link not found!", statusCode: 404 }, { status: 200 }); }

        //! If link status is inactive, then, return to homepage
        if (!aliasData.status) { return NextResponse.json({ message: "Link is disabled!", statusCode: 404 }, { status: 200 }); }

        //! Get user IP Address & fetch their location
        const ip = await FetchUserIP();
        const ipData = await axios.get(`http://ip-api.com/json/${ip}`);

        //! User IP response
        const { data: { query, status, country, countryCode, region, regionName, city, zip, timezone, isp, org, as } } = ipData;

        //! If IP status is true, then, Save clicks tracking data, & updateing clicks count for link & website stats
        if (status) {
            await new clicksTrackingModel({
                userName: aliasData.userName,
                alias: aliasData._id,
                ip: query,
                countryName: country,
                countryCode,
                stateCode: region,
                stateName: regionName,
                cityName: city,
                zip, timezone, isp, org, as,
                browser: browser.name,
                os: os.name,
                device: device.type || "Desktop",
                referrer: referrerSite || 'direct'
            }).save();

            //! Increment link click count
            await linksListModel.updateMany({ alias }, { $inc: { clicksCount: 1 } });

            //! Increment link click count for current week, month, & year
            const updateWebsiteStats = await websiteStatsModel.updateOne({ weekNumber: getWeekNumber(), monthNumber: getMonthNumber(), yearNumber: getYearNumber() }, { $inc: { linksClicksCount: 1 } });

            //! If current week, month, & year not found, then, create new record
            if (updateWebsiteStats.matchedCount === 0) {
                await new websiteStatsModel({ weekNumber: getWeekNumber(), monthNumber: getMonthNumber(), yearNumber: getYearNumber(), linksClicksCount: 1 }).save();
            }
        }

        return NextResponse.json({
            message: "Link fetched successfully.",
            statusCode: 200,
            destinationURL: aliasData.destinationURL,
            toSupport: aliasData.toSupport,
            status: aliasData.status,
            isApp: aliasData.isApp,
        }, { status: 200 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: "Internal Server Error.", status: 500 }, { status: 200 });
    }
}

export async function POST(request: NextRequest) {
    return NextResponse.json({ message: "Just A POST Call In RedirectToLink.", statusCode: 200, }, { status: 200 });
}