import React, { useContext } from 'react';
import Head from 'next/head';
import Voting from '@/components/Voting';
import Layout from '@/components/Layout';

export default function VotingPage() {
  return (
    <>
      <Head>
        <title>worldDao • Voting</title>
      </Head>
      <Layout>
        <Voting />
      </Layout>
    </>
  );
}
