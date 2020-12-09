import { Change, diffChars } from 'diff';
// @ts-ignore the lib do not have TS declarations yet
import matchAll from 'string.prototype.matchall';
import { MentionData, Part, Position, RegexMatchResult, Suggestion } from '../types';

const mentionRegEx = /(?<original>@\[(?<name>.+)]\((?<id>([0-9]*))\))/gi;

type CharactersDiffChange = Omit<Change, 'count'> & { count: number };

/**
 * Function that finding all changes between two strings;
 *
 * @param originalText
 * @param changedText
 * @returns Deleted and added positions relates to original string
 */
const getChangedPositions = (originalText: string, changedText: string) => {
  const changes = diffChars(originalText, changedText) as CharactersDiffChange[];

  const changePositions: {
    deleted: Position[];
    added: {
      start: number;
      value: string;
    }[];
  } = {
    deleted: [],
    added: [],
  };

  let originalCursor = 0;

  changes.forEach(({count, removed, added, value}) => {
    switch (true) {
      case removed: {
        changePositions.deleted.push({
          start: originalCursor,
          end: originalCursor + count,
        });
        originalCursor += count;

        return;
      }

      case added: {
        changePositions.added.push({
          start: originalCursor,
          value,
        });

        return;
      }

      default: {
        originalCursor += count;
      }
    }
  });

  return changePositions;
};

const getPart = (text: string, positionOffset = 0): Part => ({
  text,
  position: {
    start: positionOffset,
    end: positionOffset + text.length,
  },
});

const getMentionPart = (trigger: string, mention: MentionData, positionOffset = 0): Part => {
  const text = `${trigger}${mention.name}`;

  return {
    text,
    position: {
      start: positionOffset,
      end: positionOffset + text.length,
    },
    data: mention,
  };
};

const getMentionValue = (suggestion: Suggestion) => `@[${suggestion.name}](${suggestion.id})`;

/**
 * Function for generating parts array from value
 *
 * @param trigger
 * @param value
 */
const getParts = (trigger: string, value: string) => {
  const results: RegexMatchResult[] = Array.from(matchAll(value ?? '', mentionRegEx));
  const parts: Part[] = [];

  let plainText = '';

  // In case when we don't have any mentions we just return the only one part with plain text
  if (results.length == 0) {
    parts.push(getPart(value, 0));

    plainText += value;

    return {
      parts,
      plainText,
    };
  }

  // In case when we have some text before first mention
  if (results[0].index != 0) {
    const text = value.substr(0, results[0].index);

    parts.push(getPart(text, 0));

    plainText += text;
  }

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    const mentionPart = getMentionPart(trigger, result.groups, plainText.length);

    parts.push(mentionPart);

    plainText += mentionPart.text;

    if ((result.index + result.groups.original.length) !== value.length) {
      const isLastResult = i == results.length - 1;

      const text = value.slice(
        result.index + result.groups.original.length,
        isLastResult ? undefined : results[i + 1].index,
      );

      parts.push(getPart(text, plainText.length));

      plainText += text;
    }
  }

  return {
    plainText,
    parts: parts.filter(item => item.text),
  };
};

/**
 * Function for generation value from parts array
 *
 * @param parts
 */
const getValue = (parts: Part[]) => parts
  .map(item => (item.data ? item.data.original : item.text))
  .join('');

/**
 * Replace all mention values in value to some specified format
 *
 * @param value - value that is generated by Mentions component
 * @param replacer - function that takes mention object as parameter and returns string
 */
const replaceMentionValues = (
  value: string,
  replacer: (mention: MentionData) => string,
) => value.replace(mentionRegEx, (mention, original, name, id) => replacer({original, name, id}));

export {
  mentionRegEx,
  getChangedPositions,
  getPart,
  getMentionPart,
  getMentionValue,
  getParts,
  getValue,
  replaceMentionValues,
};
